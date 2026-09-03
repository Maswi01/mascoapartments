package buildings

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"
)

var (
	ErrBuildingNotFound = errors.New("building not found")
	ErrFloorNotFound    = errors.New("floor not found")
	ErrUnitNotFound     = errors.New("unit not found")
	ErrTenantNotFound   = errors.New("tenant not found")
	ErrContractNotFound = errors.New("contract not found")
	ErrInvoiceNotFound  = errors.New("invoice not found")
)

// Service is a simple in-memory implementation for the initial MVP.
type Service struct {
	buildings map[string]*Building
	floors    map[string]*Floor
	units     map[string]*Unit
	tenants   map[string]*Tenant
	contracts map[string]*Contract
	invoices  map[string]*Invoice
	documents map[string]*Document
}

func NewService() *Service {
	return &Service{
		buildings: map[string]*Building{},
		floors:    map[string]*Floor{},
		units:     map[string]*Unit{},
		tenants:   map[string]*Tenant{},
		contracts: map[string]*Contract{},
		invoices:  map[string]*Invoice{},
		documents: map[string]*Document{},
	}
}

func (s *Service) CreateBuilding(b Building) (*Building, error) {
	if b.ID == "" {
		b.ID = "bldg-" + randomID()
	}
	if b.Name == "" {
		return nil, errors.New("building name is required")
	}
	if b.Code == "" {
		return nil, errors.New("building code is required")
	}

	s.buildings[b.ID] = &b
	return s.buildings[b.ID], nil
}

func (s *Service) ListBuildings() []*Building {
	items := make([]*Building, 0, len(s.buildings))
	for _, b := range s.buildings {
		items = append(items, b)
	}
	return items
}

func (s *Service) GetBuilding(id string) (*Building, error) {
	building, ok := s.buildings[id]
	if !ok {
		return nil, ErrBuildingNotFound
	}
	return building, nil
}

func (s *Service) CreateFloor(f Floor) (*Floor, error) {
	if f.ID == "" {
		f.ID = "floor-" + randomID()
	}
	if f.BuildingID == "" {
		return nil, errors.New("building id is required")
	}
	if f.Name == "" {
		return nil, errors.New("floor name is required")
	}

	s.floors[f.ID] = &f
	return s.floors[f.ID], nil
}

func (s *Service) ListFloorsByBuilding(buildingID string) []*Floor {
	items := make([]*Floor, 0)
	for _, f := range s.floors {
		if f.BuildingID == buildingID {
			items = append(items, f)
		}
	}
	return items
}

func (s *Service) CreateUnit(u Unit) (*Unit, error) {
	if u.ID == "" {
		u.ID = "unit-" + randomID()
	}
	if u.BuildingID == "" {
		return nil, errors.New("building id is required")
	}
	if u.Number == "" {
		return nil, errors.New("unit number is required")
	}
	if u.Type == "" {
		return nil, errors.New("unit type is required")
	}

	s.units[u.ID] = &u
	return s.units[u.ID], nil
}

func (s *Service) ListUnitsByBuilding(buildingID string) []*Unit {
	items := make([]*Unit, 0)
	for _, unit := range s.units {
		if unit.BuildingID == buildingID {
			items = append(items, unit)
		}
	}
	return items
}

func (s *Service) GetUnit(id string) (*Unit, error) {
	unit, ok := s.units[id]
	if !ok {
		return nil, ErrUnitNotFound
	}
	return unit, nil
}

func (s *Service) CreateTenant(t Tenant) (*Tenant, error) {
	if t.ID == "" {
		t.ID = "tenant-" + randomID()
	}
	if t.Type == "" {
		return nil, errors.New("tenant type is required")
	}
	if t.FullName == "" && t.CompanyName == "" {
		return nil, errors.New("tenant name is required")
	}

	s.tenants[t.ID] = &t
	return s.tenants[t.ID], nil
}

func (s *Service) ListTenants() []*Tenant {
	items := make([]*Tenant, 0, len(s.tenants))
	for _, tenant := range s.tenants {
		items = append(items, tenant)
	}
	return items
}

func (s *Service) GetTenant(id string) (*Tenant, error) {
	tenant, ok := s.tenants[id]
	if !ok {
		return nil, ErrTenantNotFound
	}
	return tenant, nil
}

func (s *Service) CreateContract(c Contract) (*Contract, error) {
	if c.ID == "" {
		c.ID = "contract-" + randomID()
	}
	if c.UnitID == "" {
		return nil, errors.New("unit id is required")
	}
	if c.TenantID == "" {
		return nil, errors.New("tenant id is required")
	}
	if c.ContractType == "" {
		return nil, errors.New("contract type is required")
	}

	s.contracts[c.ID] = &c
	return s.contracts[c.ID], nil
}

func (s *Service) ListContracts() []*Contract {
	items := make([]*Contract, 0, len(s.contracts))
	for _, contract := range s.contracts {
		items = append(items, contract)
	}
	return items
}

func (s *Service) GetContract(id string) (*Contract, error) {
	contract, ok := s.contracts[id]
	if !ok {
		return nil, ErrContractNotFound
	}
	return contract, nil
}

func (s *Service) CreateDocument(document Document) (*Document, error) {
	if document.ContractID == "" || document.Name == "" || document.Path == "" {
		return nil, errors.New("contract id, document name, and path are required")
	}
	document.ID = "doc-" + randomID()
	document.CreatedAt = time.Now()
	s.documents[document.ID] = &document
	return s.documents[document.ID], nil
}

func (s *Service) ListDocumentsByContract(contractID string) []*Document {
	items := make([]*Document, 0)
	for _, document := range s.documents {
		if document.ContractID == contractID {
			items = append(items, document)
		}
	}
	return items
}

func (s *Service) CreateInvoice(i Invoice) (*Invoice, error) {
	if i.ID == "" {
		i.ID = "invoice-" + randomID()
	}
	if i.ContractID == "" {
		return nil, errors.New("contract id is required")
	}
	if i.TenantID == "" {
		return nil, errors.New("tenant id is required")
	}
	if i.UnitID == "" {
		return nil, errors.New("unit id is required")
	}
	if i.Number == "" {
		return nil, errors.New("invoice number is required")
	}

	s.invoices[i.ID] = &i
	return s.invoices[i.ID], nil
}

func (s *Service) ListInvoices() []*Invoice {
	items := make([]*Invoice, 0, len(s.invoices))
	for _, invoice := range s.invoices {
		items = append(items, invoice)
	}
	return items
}

func (s *Service) DashboardSummary() DashboardSummary {
	summary := DashboardSummary{
		Buildings: len(s.buildings),
		Floors:    len(s.floors),
		Units:     len(s.units),
		Tenants:   len(s.tenants),
		Contracts: len(s.contracts),
		Invoices:  len(s.invoices),
	}
	return summary
}

func randomID() string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return hex.EncodeToString([]byte(time.Now().Format("150405.000000000")))[:16]
	}
	return hex.EncodeToString(bytes)
}
