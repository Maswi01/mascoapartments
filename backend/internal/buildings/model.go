package buildings

import "time"

// Building is the top-level property record for a physical property.
type Building struct {
	ID          uint64    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Address     string    `json:"address"`
	Description string    `json:"description,omitempty"`
	Floors      int       `json:"floors"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Floor represents a level or floor inside a building.
type Floor struct {
	ID          uint64    `json:"id"`
	BuildingID  uint64    `json:"building_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Unit represents a rentable physical space in a building or floor.
type Unit struct {
	ID          uint64    `json:"id"`
	BuildingID  uint64    `json:"building_id"`
	FloorID     uint64    `json:"floor_id,omitempty"`
	Number      string    `json:"number"`
	Type        string    `json:"type"`
	Description string    `json:"description,omitempty"`
	BaseRent    float64   `json:"base_rent"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Tenant struct {
	ID              uint64    `json:"id"`
	BuildingID      uint64    `json:"building_id"`
	Type            string    `json:"type"`
	FullName        string    `json:"full_name,omitempty"`
	CompanyName     string    `json:"company_name,omitempty"`
	ContactPerson   string    `json:"contact_person,omitempty"`
	Phone           string    `json:"phone,omitempty"`
	Email           string    `json:"email,omitempty"`
	Address         string    `json:"address,omitempty"`
	IDNumber        string    `json:"id_number,omitempty"`
	RegistrationRef string    `json:"registration_ref,omitempty"`
	Notes           string    `json:"notes,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Contract struct {
	ID                    uint64    `json:"id"`
	BuildingID            uint64    `json:"building_id"`
	UnitID                uint64    `json:"unit_id"`
	TenantID              uint64    `json:"tenant_id"`
	ContractType          string    `json:"contract_type"`
	StartDate             string    `json:"start_date"`
	EndDate               string    `json:"end_date,omitempty"`
	MonthlyRent           float64   `json:"monthly_rent"`
	PaymentMethod         string    `json:"payment_method,omitempty"`
	PaymentFrequency      string    `json:"payment_frequency,omitempty"`
	UtilityResponsibility string    `json:"utility_responsibility,omitempty"`
	Terms                 string    `json:"terms,omitempty"`
	Status                string    `json:"status"`
	Notes                 string    `json:"notes,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type Document struct {
	ID           uint64    `json:"id"`
	ContractID   uint64    `json:"contract_id"`
	Name         string    `json:"name"`
	OriginalName string    `json:"original_name"`
	Path         string    `json:"path"`
	MimeType     string    `json:"mime_type"`
	CreatedAt    time.Time `json:"created_at"`
}

type Invoice struct {
	ID          uint64    `json:"id"`
	ContractID  uint64    `json:"contract_id"`
	TenantID    uint64    `json:"tenant_id"`
	BuildingID  uint64    `json:"building_id"`
	UnitID      uint64    `json:"unit_id"`
	Number      string    `json:"number"`
	IssueDate   string    `json:"issue_date"`
	DueDate     string    `json:"due_date"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Payment struct {
	ID               uint64    `json:"id"`
	TenantID         uint64    `json:"tenant_id"`
	InvoiceID        uint64    `json:"invoice_id"`
	BuildingID       uint64    `json:"building_id"`
	UnitID           uint64    `json:"unit_id"`
	PaymentReference string    `json:"payment_reference"`
	Amount           float64   `json:"amount"`
	PaymentDate      string    `json:"payment_date"`
	PaymentMethod    string    `json:"payment_method"`
	ReceiptNumber    string    `json:"receipt_number,omitempty"`
	Notes            string    `json:"notes,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

type DashboardSummary struct {
	Buildings int `json:"buildings"`
	Floors    int `json:"floors"`
	Units     int `json:"units"`
	Tenants   int `json:"tenants"`
	Contracts int `json:"contracts"`
	Invoices  int `json:"invoices"`
}

// ExpenseCategory groups recurring or one-off building expenses for reporting.
type ExpenseCategory struct {
	ID        uint64    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Expense struct {
	ID          uint64    `json:"id"`
	BuildingID  uint64    `json:"building_id"`
	CategoryID  uint64    `json:"category_id"`
	Amount      float64   `json:"amount"`
	ExpenseDate string    `json:"expense_date"`
	Reference   string    `json:"reference,omitempty"`
	Notes       string    `json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
