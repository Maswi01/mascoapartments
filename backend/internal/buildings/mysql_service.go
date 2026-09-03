package buildings

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"
)

// MySQLService is the production persistence implementation.
type MySQLService struct {
	db *sql.DB
}

func NewMySQLService(db *sql.DB) *MySQLService {
	return &MySQLService{db: db}
}

func (s *MySQLService) CreateBuilding(building Building) (*Building, error) {
	if building.Name == "" || building.Code == "" || building.Address == "" {
		return nil, errors.New("building name, code, and address are required")
	}
	building.CreatedAt = time.Now()
	building.UpdatedAt = building.CreatedAt
	result, err := s.db.Exec(`INSERT INTO buildings (name, code, address, description, number_of_floors, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, building.Name, building.Code, building.Address, building.Description, building.Floors, building.Status, building.CreatedAt, building.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save building: %w", err)
	}
	building.ID, err = databaseID(result)
	if err != nil {
		return nil, fmt.Errorf("read building id: %w", err)
	}
	return &building, nil
}

func databaseID(result sql.Result) (string, error) {
	id, err := result.LastInsertId()
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(id, 10), nil
}

func (s *MySQLService) ListBuildings() []*Building {
	rows, err := s.db.Query(`SELECT id, name, code, address, description, number_of_floors, status, created_at, updated_at FROM buildings ORDER BY created_at DESC`)
	if err != nil {
		return []*Building{}
	}
	defer rows.Close()
	items := make([]*Building, 0)
	for rows.Next() {
		item := &Building{}
		if rows.Scan(&item.ID, &item.Name, &item.Code, &item.Address, &item.Description, &item.Floors, &item.Status, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) CreateFloor(floor Floor) (*Floor, error) {
	if floor.BuildingID == "" || floor.Name == "" {
		return nil, errors.New("building id and floor name are required")
	}
	floor.ID = "floor-" + randomID()
	floor.CreatedAt = time.Now()
	floor.UpdatedAt = floor.CreatedAt
	_, err := s.db.Exec(`INSERT INTO floors (id, building_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, floor.ID, floor.BuildingID, floor.Name, floor.Description, floor.CreatedAt, floor.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save floor: %w", err)
	}
	return &floor, nil
}

func (s *MySQLService) ListFloorsByBuilding(buildingID string) []*Floor {
	rows, err := s.db.Query(`SELECT id, building_id, name, description, created_at, updated_at FROM floors WHERE building_id = ? ORDER BY created_at`, buildingID)
	if err != nil {
		return []*Floor{}
	}
	defer rows.Close()
	items := make([]*Floor, 0)
	for rows.Next() {
		item := &Floor{}
		if rows.Scan(&item.ID, &item.BuildingID, &item.Name, &item.Description, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) CreateUnit(unit Unit) (*Unit, error) {
	if unit.BuildingID == "" || unit.Number == "" || unit.Type == "" {
		return nil, errors.New("building id, unit number, and unit type are required")
	}
	unit.CreatedAt = time.Now()
	unit.UpdatedAt = unit.CreatedAt
	result, err := s.db.Exec(`INSERT INTO units (building_id, floor_id, unit_number, unit_type, description, bedrooms, bathrooms, approximate_size, status, created_at, updated_at) VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?)`, unit.BuildingID, unit.FloorID, unit.Number, unit.Type, unit.Description, unit.Bedrooms, unit.Bathrooms, unit.Size, unit.Status, unit.CreatedAt, unit.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save unit: %w", err)
	}
	unit.ID, err = databaseID(result)
	if err != nil {
		return nil, fmt.Errorf("read unit id: %w", err)
	}
	return &unit, nil
}

func (s *MySQLService) ListUnitsByBuilding(buildingID string) []*Unit {
	rows, err := s.db.Query(`SELECT id, building_id, COALESCE(floor_id, ''), unit_number, unit_type, description, bedrooms, bathrooms, approximate_size, status, created_at, updated_at FROM units WHERE building_id = ? ORDER BY unit_number`, buildingID)
	if err != nil {
		return []*Unit{}
	}
	defer rows.Close()
	items := make([]*Unit, 0)
	for rows.Next() {
		item := &Unit{}
		if rows.Scan(&item.ID, &item.BuildingID, &item.FloorID, &item.Number, &item.Type, &item.Description, &item.Bedrooms, &item.Bathrooms, &item.Size, &item.Status, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) GetUnit(id string) (*Unit, error) {
	unit := &Unit{}
	err := s.db.QueryRow(`SELECT id, building_id, COALESCE(floor_id, ''), unit_number, unit_type, description, bedrooms, bathrooms, approximate_size, status, created_at, updated_at FROM units WHERE id = ?`, id).Scan(&unit.ID, &unit.BuildingID, &unit.FloorID, &unit.Number, &unit.Type, &unit.Description, &unit.Bedrooms, &unit.Bathrooms, &unit.Size, &unit.Status, &unit.CreatedAt, &unit.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get unit: %w", err)
	}
	return unit, nil
}

func (s *MySQLService) CreateTenant(tenant Tenant) (*Tenant, error) {
	if tenant.Type == "" || (tenant.FullName == "" && tenant.CompanyName == "") {
		return nil, errors.New("tenant type and name are required")
	}
	tenant.ID = "tenant-" + randomID()
	tenant.CreatedAt = time.Now()
	tenant.UpdatedAt = tenant.CreatedAt
	_, err := s.db.Exec(`INSERT INTO tenants (id, type, full_name, company_name, contact_person, phone, email, address, id_number, registration_ref, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, tenant.ID, tenant.Type, tenant.FullName, tenant.CompanyName, tenant.ContactPerson, tenant.Phone, tenant.Email, tenant.Address, tenant.IDNumber, tenant.RegistrationRef, tenant.Notes, tenant.CreatedAt, tenant.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save tenant: %w", err)
	}
	return &tenant, nil
}

func (s *MySQLService) ListTenants() []*Tenant {
	rows, err := s.db.Query(`SELECT id, type, full_name, company_name, contact_person, phone, email, address, id_number, registration_ref, notes, created_at, updated_at FROM tenants ORDER BY created_at DESC`)
	if err != nil {
		return []*Tenant{}
	}
	defer rows.Close()
	items := make([]*Tenant, 0)
	for rows.Next() {
		item := &Tenant{}
		if rows.Scan(&item.ID, &item.Type, &item.FullName, &item.CompanyName, &item.ContactPerson, &item.Phone, &item.Email, &item.Address, &item.IDNumber, &item.RegistrationRef, &item.Notes, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) GetTenant(id string) (*Tenant, error) {
	tenant := &Tenant{}
	err := s.db.QueryRow(`SELECT id, type, full_name, company_name, contact_person, phone, email, address, id_number, registration_ref, notes, created_at, updated_at FROM tenants WHERE id = ?`, id).Scan(&tenant.ID, &tenant.Type, &tenant.FullName, &tenant.CompanyName, &tenant.ContactPerson, &tenant.Phone, &tenant.Email, &tenant.Address, &tenant.IDNumber, &tenant.RegistrationRef, &tenant.Notes, &tenant.CreatedAt, &tenant.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrTenantNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get tenant: %w", err)
	}
	return tenant, nil
}

func (s *MySQLService) CreateContract(contract Contract) (*Contract, error) {
	if contract.UnitID == "" || contract.TenantID == "" || contract.ContractType == "" {
		return nil, errors.New("unit id, tenant id, and contract type are required")
	}
	contract.ID = "contract-" + randomID()
	contract.CreatedAt = time.Now()
	contract.UpdatedAt = contract.CreatedAt
	_, err := s.db.Exec(`INSERT INTO contracts (id, unit_id, tenant_id, contract_type, start_date, end_date, monthly_rent, payment_method, payment_frequency, utility_responsibility, terms, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?)`, contract.ID, contract.UnitID, contract.TenantID, contract.ContractType, contract.StartDate, contract.EndDate, contract.MonthlyRent, contract.PaymentMethod, contract.PaymentFrequency, contract.UtilityResponsibility, contract.Terms, contract.Status, contract.Notes, contract.CreatedAt, contract.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save contract: %w", err)
	}
	return &contract, nil
}

func (s *MySQLService) ListContracts() []*Contract {
	rows, err := s.db.Query(`SELECT id, unit_id, tenant_id, contract_type, start_date, COALESCE(end_date, ''), monthly_rent, payment_method, payment_frequency, utility_responsibility, COALESCE(terms, ''), status, notes, created_at, updated_at FROM contracts ORDER BY created_at DESC`)
	if err != nil {
		return []*Contract{}
	}
	defer rows.Close()
	items := make([]*Contract, 0)
	for rows.Next() {
		item := &Contract{}
		if rows.Scan(&item.ID, &item.UnitID, &item.TenantID, &item.ContractType, &item.StartDate, &item.EndDate, &item.MonthlyRent, &item.PaymentMethod, &item.PaymentFrequency, &item.UtilityResponsibility, &item.Terms, &item.Status, &item.Notes, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) GetContract(id string) (*Contract, error) {
	contract := &Contract{}
	err := s.db.QueryRow(`SELECT id, unit_id, tenant_id, contract_type, start_date, COALESCE(end_date, ''), monthly_rent, payment_method, payment_frequency, utility_responsibility, COALESCE(terms, ''), status, notes, created_at, updated_at FROM contracts WHERE id = ?`, id).Scan(&contract.ID, &contract.UnitID, &contract.TenantID, &contract.ContractType, &contract.StartDate, &contract.EndDate, &contract.MonthlyRent, &contract.PaymentMethod, &contract.PaymentFrequency, &contract.UtilityResponsibility, &contract.Terms, &contract.Status, &contract.Notes, &contract.CreatedAt, &contract.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrContractNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get contract: %w", err)
	}
	return contract, nil
}

func (s *MySQLService) CreateDocument(document Document) (*Document, error) {
	if document.ContractID == "" || document.Name == "" || document.Path == "" {
		return nil, errors.New("contract id, document name, and path are required")
	}
	document.ID = "doc-" + randomID()
	document.CreatedAt = time.Now()
	_, err := s.db.Exec(`INSERT INTO documents (id, contract_id, name, original_name, path, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, document.ID, document.ContractID, document.Name, document.OriginalName, document.Path, document.MimeType, document.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("save document: %w", err)
	}
	return &document, nil
}

func (s *MySQLService) ListDocumentsByContract(contractID string) []*Document {
	rows, err := s.db.Query(`SELECT id, contract_id, name, original_name, path, mime_type, created_at FROM documents WHERE contract_id = ? ORDER BY created_at DESC`, contractID)
	if err != nil {
		return []*Document{}
	}
	defer rows.Close()
	items := make([]*Document, 0)
	for rows.Next() {
		item := &Document{}
		if rows.Scan(&item.ID, &item.ContractID, &item.Name, &item.OriginalName, &item.Path, &item.MimeType, &item.CreatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) CreateInvoice(invoice Invoice) (*Invoice, error) {
	if invoice.ContractID == "" || invoice.TenantID == "" || invoice.UnitID == "" || invoice.Number == "" {
		return nil, errors.New("contract id, tenant id, unit id, and invoice number are required")
	}
	invoice.CreatedAt = time.Now()
	invoice.UpdatedAt = invoice.CreatedAt
	result, err := s.db.Exec(`INSERT INTO invoices (tenant_id, building_id, unit_id, contract_id, invoice_number, amount, issue_date, due_date, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, invoice.TenantID, invoice.BuildingID, invoice.UnitID, invoice.ContractID, invoice.Number, invoice.Amount, invoice.IssueDate, invoice.DueDate, invoice.Description, invoice.Status, invoice.CreatedAt, invoice.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("save invoice: %w", err)
	}
	invoice.ID, err = databaseID(result)
	if err != nil {
		return nil, fmt.Errorf("read invoice id: %w", err)
	}
	return &invoice, nil
}

func (s *MySQLService) ListInvoices() []*Invoice {
	rows, err := s.db.Query(`SELECT id, contract_id, tenant_id, building_id, unit_id, invoice_number, issue_date, due_date, amount, description, status, created_at, updated_at FROM invoices ORDER BY created_at DESC`)
	if err != nil {
		return []*Invoice{}
	}
	defer rows.Close()
	items := make([]*Invoice, 0)
	for rows.Next() {
		item := &Invoice{}
		if rows.Scan(&item.ID, &item.ContractID, &item.TenantID, &item.BuildingID, &item.UnitID, &item.Number, &item.IssueDate, &item.DueDate, &item.Amount, &item.Description, &item.Status, &item.CreatedAt, &item.UpdatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) CreatePayment(payment Payment) (*Payment, error) {
	if payment.InvoiceID == "" || payment.PaymentReference == "" || payment.Amount <= 0 || payment.PaymentMethod == "" {
		return nil, errors.New("invoice, payment reference, amount, and payment method are required")
	}
	var invoice Invoice
	err := s.db.QueryRow(`SELECT tenant_id, building_id, unit_id, amount FROM invoices WHERE id = ?`, payment.InvoiceID).Scan(&invoice.TenantID, &invoice.BuildingID, &invoice.UnitID, &invoice.Amount)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("invoice not found")
	}
	if err != nil {
		return nil, fmt.Errorf("load invoice: %w", err)
	}
	var methodID uint64
	if err := s.db.QueryRow(`SELECT id FROM payment_methods WHERE name = ?`, payment.PaymentMethod).Scan(&methodID); err != nil {
		return nil, errors.New("payment method not found")
	}
	payment.TenantID, payment.BuildingID, payment.UnitID = invoice.TenantID, invoice.BuildingID, invoice.UnitID
	payment.CreatedAt = time.Now()
	result, err := s.db.Exec(`INSERT INTO payments (tenant_id, invoice_id, building_id, unit_id, payment_reference, amount, payment_date, payment_method_id, receipt_number, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?)`, payment.TenantID, payment.InvoiceID, payment.BuildingID, payment.UnitID, payment.PaymentReference, payment.Amount, payment.PaymentDate, methodID, payment.ReceiptNumber, payment.Notes, payment.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("save payment: %w", err)
	}
	payment.ID, err = databaseID(result)
	if err != nil {
		return nil, fmt.Errorf("read payment id: %w", err)
	}
	var paid float64
	if err := s.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?`, payment.InvoiceID).Scan(&paid); err == nil {
		status := "Partially Paid"
		if paid >= invoice.Amount {
			status = "Paid"
		}
		_, _ = s.db.Exec(`UPDATE invoices SET status = ? WHERE id = ?`, status, payment.InvoiceID)
	}
	return &payment, nil
}

func (s *MySQLService) ListPayments() []*Payment {
	rows, err := s.db.Query(`SELECT p.id, p.tenant_id, p.invoice_id, p.building_id, p.unit_id, p.payment_reference, p.amount, p.payment_date, pm.name, COALESCE(p.receipt_number, ''), COALESCE(p.notes, ''), p.created_at FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id ORDER BY p.created_at DESC`)
	if err != nil {
		return []*Payment{}
	}
	defer rows.Close()
	items := make([]*Payment, 0)
	for rows.Next() {
		item := &Payment{}
		if rows.Scan(&item.ID, &item.TenantID, &item.InvoiceID, &item.BuildingID, &item.UnitID, &item.PaymentReference, &item.Amount, &item.PaymentDate, &item.PaymentMethod, &item.ReceiptNumber, &item.Notes, &item.CreatedAt) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *MySQLService) DashboardSummary() DashboardSummary {
	summary := DashboardSummary{}
	for _, counter := range []struct {
		table       string
		destination *int
	}{{"buildings", &summary.Buildings}, {"floors", &summary.Floors}, {"units", &summary.Units}, {"tenants", &summary.Tenants}, {"contracts", &summary.Contracts}, {"invoices", &summary.Invoices}} {
		_ = s.db.QueryRow("SELECT COUNT(*) FROM " + counter.table).Scan(counter.destination)
	}
	return summary
}
