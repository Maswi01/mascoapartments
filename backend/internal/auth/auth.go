package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID       uint64   `json:"id"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	FullName string   `json:"full_name"`
	Status   string   `json:"status"`
	Roles    []string `json:"roles"`
}

type UserInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Password string `json:"password"`
	Status   string `json:"status"`
}

type Service struct {
	db        *sql.DB
	jwtSecret []byte
}

// defaultPermissions seeds the permission catalog used to gate feature access per role.
var defaultPermissions = []string{
	"manage_buildings",
	"manage_units",
	"manage_tenants",
	"manage_contracts",
	"manage_invoices",
	"manage_payments",
	"manage_expenses",
	"manage_users",
	"view_reports",
}

func NewService(db *sql.DB, jwtSecret string) (*Service, error) {
	if len(jwtSecret) < 32 {
		return nil, errors.New("JWT_SECRET must contain at least 32 characters")
	}
	service := &Service{db: db, jwtSecret: []byte(jwtSecret)}
	if err := service.ensurePermissionTables(); err != nil {
		return nil, err
	}
	return service, nil
}

func (s *Service) ensurePermissionTables() error {
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS permissions (
		id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(191) NOT NULL UNIQUE
	)`); err != nil {
		return fmt.Errorf("ensure permissions table: %w", err)
	}
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS role_permissions (
		role_id BIGINT UNSIGNED NOT NULL,
		permission_id BIGINT UNSIGNED NOT NULL,
		PRIMARY KEY (role_id, permission_id)
	)`); err != nil {
		return fmt.Errorf("ensure role_permissions table: %w", err)
	}
	for _, name := range defaultPermissions {
		if _, err := s.db.Exec(`INSERT IGNORE INTO permissions (name) VALUES (?)`, name); err != nil {
			return fmt.Errorf("seed permission %s: %w", name, err)
		}
	}
	return nil
}

func (s *Service) Login(usernameOrEmail string, password string) (string, *User, error) {
	user := &User{}
	var passwordHash string
	err := s.db.QueryRow(`SELECT id, username, email, password_hash, full_name FROM users WHERE (username = ? OR email = ?) AND status = 'Active'`, usernameOrEmail, usernameOrEmail).Scan(&user.ID, &user.Username, &user.Email, &passwordHash, &user.FullName)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil, errors.New("invalid username or password")
	}
	if err != nil {
		return "", nil, fmt.Errorf("load user: %w", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) != nil {
		return "", nil, errors.New("invalid username or password")
	}

	roles, err := s.userRoles(user.ID)
	if err != nil {
		return "", nil, err
	}
	user.Roles = roles
	claims := jwt.MapClaims{
		"sub": fmt.Sprint(user.ID),
		"usr": user.Username,
		"rol": user.Roles,
		"exp": time.Now().Add(12 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
	if err != nil {
		return "", nil, fmt.Errorf("sign token: %w", err)
	}
	return token, user, nil
}

func (s *Service) Authenticate(tokenString string) (*User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid access token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid access token")
	}
	userID, ok := claims["sub"].(string)
	if !ok {
		return nil, errors.New("invalid access token")
	}
	var user User
	err = s.db.QueryRow(`SELECT id, username, email, full_name FROM users WHERE id = ? AND status = 'Active'`, userID).Scan(&user.ID, &user.Username, &user.Email, &user.FullName)
	if err != nil {
		return nil, errors.New("invalid access token")
	}
	roles, err := s.userRoles(user.ID)
	if err != nil {
		return nil, err
	}
	user.Roles = roles
	return &user, nil
}

func (s *Service) UpdateProfile(userID uint64, fullName string, email string) (*User, error) {
	if fullName == "" || email == "" {
		return nil, errors.New("full name and email are required")
	}
	if _, err := s.db.Exec(`UPDATE users SET full_name = ?, email = ? WHERE id = ?`, fullName, email, userID); err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}
	user := &User{}
	err := s.db.QueryRow(`SELECT id, username, email, full_name FROM users WHERE id = ?`, userID).Scan(&user.ID, &user.Username, &user.Email, &user.FullName)
	if err != nil {
		return nil, fmt.Errorf("load user: %w", err)
	}
	roles, err := s.userRoles(user.ID)
	if err != nil {
		return nil, err
	}
	user.Roles = roles
	return user, nil
}

func (s *Service) ChangePassword(userID uint64, currentPassword string, newPassword string) error {
	if len(newPassword) < 8 {
		return errors.New("new password must be at least 8 characters")
	}
	var passwordHash string
	if err := s.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, userID).Scan(&passwordHash); err != nil {
		return fmt.Errorf("load user: %w", err)
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(currentPassword)) != nil {
		return errors.New("current password is incorrect")
	}
	nextHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	if _, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, string(nextHash), userID); err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	return nil
}

func (s *Service) ListUsers() ([]User, error) {
	rows, err := s.db.Query(`SELECT id, username, email, full_name, status FROM users ORDER BY full_name`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()
	users := make([]User, 0)
	for rows.Next() {
		user := User{}
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.FullName, &user.Status); err != nil {
			return nil, err
		}
		user.Roles, err = s.userRoles(user.ID)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Service) CreateUser(input UserInput) (*User, error) {
	if input.Username == "" || input.Email == "" || input.FullName == "" || len(input.Password) < 8 {
		return nil, errors.New("username, email, full name, and an 8 character password are required")
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	status := input.Status
	if status == "" {
		status = "Active"
	}
	result, err := s.db.Exec(`INSERT INTO users (username, email, password_hash, full_name, status) VALUES (?, ?, ?, ?, ?)`, input.Username, input.Email, string(passwordHash), input.FullName, status)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return &User{ID: uint64(id), Username: input.Username, Email: input.Email, FullName: input.FullName, Roles: []string{}}, nil
}

func (s *Service) UpdateUserStatus(userID uint64, status string) error {
	if status != "Active" && status != "Inactive" && status != "Suspended" {
		return errors.New("invalid user status")
	}
	_, err := s.db.Exec(`UPDATE users SET status = ? WHERE id = ?`, status, userID)
	return err
}

func (s *Service) ListRoles() ([]string, error) {
	rows, err := s.db.Query(`SELECT name FROM roles ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()
	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (s *Service) AssignRole(userID uint64, roleName string) error {
	var roleID uint64
	if err := s.db.QueryRow(`SELECT id FROM roles WHERE name = ?`, roleName).Scan(&roleID); err != nil {
		return errors.New("role not found")
	}
	_, err := s.db.Exec(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, userID, roleID)
	return err
}

func (s *Service) CreateRole(name string) error {
	if name == "" {
		return errors.New("role name is required")
	}
	_, err := s.db.Exec(`INSERT INTO roles (name) VALUES (?)`, name)
	if err != nil {
		return fmt.Errorf("create role: %w", err)
	}
	return nil
}

func (s *Service) ListPermissions() ([]string, error) {
	rows, err := s.db.Query(`SELECT name FROM permissions ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()
	permissions := make([]string, 0)
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	return permissions, rows.Err()
}

func (s *Service) ListRolePermissions(roleName string) ([]string, error) {
	rows, err := s.db.Query(`SELECT p.name FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id JOIN roles r ON r.id = rp.role_id WHERE r.name = ? ORDER BY p.name`, roleName)
	if err != nil {
		return nil, fmt.Errorf("list role permissions: %w", err)
	}
	defer rows.Close()
	permissions := make([]string, 0)
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	return permissions, rows.Err()
}

func (s *Service) SetRolePermission(roleName string, permissionName string, granted bool) error {
	var roleID uint64
	if err := s.db.QueryRow(`SELECT id FROM roles WHERE name = ?`, roleName).Scan(&roleID); err != nil {
		return errors.New("role not found")
	}
	var permissionID uint64
	if err := s.db.QueryRow(`SELECT id FROM permissions WHERE name = ?`, permissionName).Scan(&permissionID); err != nil {
		return errors.New("permission not found")
	}
	if granted {
		_, err := s.db.Exec(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, roleID, permissionID)
		return err
	}
	_, err := s.db.Exec(`DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?`, roleID, permissionID)
	return err
}

func (s *Service) userRoles(userID uint64) ([]string, error) {
	rows, err := s.db.Query(`SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.name`, userID)
	if err != nil {
		return nil, fmt.Errorf("load roles: %w", err)
	}
	defer rows.Close()
	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}
