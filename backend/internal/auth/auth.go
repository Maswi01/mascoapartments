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
	Roles    []string `json:"roles"`
}

type Service struct {
	db        *sql.DB
	jwtSecret []byte
}

func NewService(db *sql.DB, jwtSecret string) (*Service, error) {
	if len(jwtSecret) < 32 {
		return nil, errors.New("JWT_SECRET must contain at least 32 characters")
	}
	return &Service{db: db, jwtSecret: []byte(jwtSecret)}, nil
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
