package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/Maswi01/mascoapartments/backend/internal/auth"
	"github.com/Maswi01/mascoapartments/backend/internal/buildings"
	"github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	database, err := openDatabase()
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	authService, err := auth.NewService(database, os.Getenv("JWT_SECRET"))
	if err != nil {
		log.Fatal(err)
	}
	service := buildings.NewMySQLService(database)
	handler := buildings.NewHandler(service)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", healthHandler)
	mux.HandleFunc("POST /api/v1/auth/login", loginHandler(authService))
	mux.HandleFunc("GET /api/v1/auth/me", meHandler(authService))
	mux.HandleFunc("PUT /api/v1/auth/me", updateProfileHandler(authService))
	mux.HandleFunc("POST /api/v1/auth/me/password", changePasswordHandler(authService))
	handler.RegisterRoutes(mux)

	server := &http.Server{
		Addr:    ":" + envOrDefault("API_PORT", "6400"),
		Handler: withCORS(requireAuth(authService, mux)),
	}

	log.Printf("API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func loginHandler(authService *auth.Service) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var credentials struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(request.Body).Decode(&credentials); err != nil || credentials.Username == "" || credentials.Password == "" {
			writeAuthError(writer, http.StatusBadRequest, "username and password are required")
			return
		}
		token, user, err := authService.Login(credentials.Username, credentials.Password)
		if err != nil {
			writeAuthError(writer, http.StatusUnauthorized, "invalid username or password")
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(map[string]interface{}{"token": token, "user": user})
	}
}

type contextKey string

const currentUserContextKey contextKey = "currentUser"

func requireAuth(authService *auth.Service, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/api/v1/health" || request.URL.Path == "/api/v1/auth/login" || request.Method == http.MethodOptions {
			next.ServeHTTP(writer, request)
			return
		}
		value := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
		if value == "" || value == request.Header.Get("Authorization") {
			writeAuthError(writer, http.StatusUnauthorized, "authentication required")
			return
		}
		currentUser, err := authService.Authenticate(value)
		if err != nil {
			writeAuthError(writer, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), currentUserContextKey, currentUser)))
	})
}

func currentUserFromRequest(request *http.Request) (*auth.User, bool) {
	user, ok := request.Context().Value(currentUserContextKey).(*auth.User)
	return user, ok
}

func meHandler(authService *auth.Service) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		user, ok := currentUserFromRequest(request)
		if !ok {
			writeAuthError(writer, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(user)
	}
}

func updateProfileHandler(authService *auth.Service) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		user, ok := currentUserFromRequest(request)
		if !ok {
			writeAuthError(writer, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		var payload struct {
			FullName string `json:"full_name"`
			Email    string `json:"email"`
		}
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			writeAuthError(writer, http.StatusBadRequest, "invalid profile payload")
			return
		}
		updated, err := authService.UpdateProfile(user.ID, payload.FullName, payload.Email)
		if err != nil {
			writeAuthError(writer, http.StatusBadRequest, err.Error())
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(updated)
	}
}

func changePasswordHandler(authService *auth.Service) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		user, ok := currentUserFromRequest(request)
		if !ok {
			writeAuthError(writer, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		var payload struct {
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
		}
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			writeAuthError(writer, http.StatusBadRequest, "invalid password payload")
			return
		}
		if err := authService.ChangePassword(user.ID, payload.CurrentPassword, payload.NewPassword); err != nil {
			writeAuthError(writer, http.StatusBadRequest, err.Error())
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		json.NewEncoder(writer).Encode(map[string]string{"status": "password updated"})
	}
}

func writeAuthError(writer http.ResponseWriter, code int, message string) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(code)
	json.NewEncoder(writer).Encode(map[string]string{"error": message})
}

func openDatabase() (*sql.DB, error) {
	config := mysql.NewConfig()
	config.User = os.Getenv("DB_USER")
	config.Passwd = os.Getenv("DB_PASSWORD")
	config.Net = "tcp"
	config.Addr = envOrDefault("DB_HOST", "127.0.0.1") + ":" + envOrDefault("DB_PORT", "3306")
	config.DBName = envOrDefault("DB_NAME", "mascoapartments")
	config.ParseTime = true

	database, err := sql.Open("mysql", config.FormatDSN())
	if err != nil {
		return nil, err
	}
	if err := database.Ping(); err != nil {
		return nil, err
	}
	return database, nil
}

func envOrDefault(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func healthHandler(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]string{"status": "ok"})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", envOrDefault("FRONTEND_ORIGIN", "http://localhost:5173"))
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}
