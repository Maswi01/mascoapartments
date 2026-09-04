package buildings

import (
	"errors"
	"fmt"
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
	buildings map[uint64]*Building
	floors    map[uint64]*Floor
	units     map[uint64]*Unit
	tenants   map[uint64]*Tenant
	contracts map[uint64]*Contract
	invoices  map[uint64]*Invoice
	payments  map[uint64]*Payment
	documents map[uint64]*Document
}

func NewService() *Service {
	return &Service{
		buildings: map[uint64]*Building{}, floors: map[uint64]*Floor{}, units: map[uint64]*Unit{},
		tenants: map[uint64]*Tenant{}, contracts: map[uint64]*Contract{}, invoices: map[uint64]*Invoice{},
		payments: map[uint64]*Payment{}, documents: map[uint64]*Document{},
	}
}

func (s *Service) CreateBuilding(b Building) (*Building, error) {
	if b.ID == 0 {
		b.ID = uint64(len(s.buildings) + 1)
	}
	if b.Name == "" {
		return nil, errors.New("building name is required")
	}
	if b.Code == "" {
		return nil, errors.New("building code is required")
	}

	s.buildings[b.ID] = &b
	for floorNumber := 1; floorNumber <= b.Floors; floorNumber++ {
		floorID := uint64(len(s.floors) + 1)
		s.floors[floorID] = &Floor{ID: floorID, BuildingID: b.ID, Name: fmt.Sprintf("Floor %d", floorNumber)}
	}
	return s.buildings[b.ID], nil
}

func (s *Service) ListBuildings() []*Building {
	items := make([]*Building, 0, len(s.buildings))
	for _, b := range s.buildings {
		items = append(items, b)
	}
	return items
}

func (s *Service) GetBuilding(id uint64) (*Building, error) {
	building, ok := s.buildings[id]
	if !ok {
		return nil, ErrBuildingNotFound
	}
	return building, nil
}

func (s *Service) CreateFloor(f Floor) (*Floor, error) {
	if f.ID == 0 {
		f.ID = uint64(len(s.floors) + 1)
	}
	if f.BuildingID == 0 {
		return nil, errors.New("building id is required")
	}
	if f.Name == "" {
		return nil, errors.New("floor name is required")
	}

	s.floors[f.ID] = &f
	return s.floors[f.ID], nil
}

func (s *Service) ListFloorsByBuilding(buildingID uint64) []*Floor {
	items := make([]*Floor, 0)
	for _, f := range s.floors {
		if f.BuildingID == buildingID {
			items = append(items, f)
		}
	}
	return items
}

func (s *Service) CreateUnit(u Unit) (*Unit, error) {
	if u.ID == 0 {
		u.ID = uint64(len(s.units) + 1)
	}
	if u.BuildingID == 0 {
		return nil, errors.New("building id is required")
	}
	if u.Number == "" {
		return nil, errors.New("unit number is required")
	}
	if u.Type == "" {
		return nil, errors.New("unit type is required")
	}

	u.Status = "Vacant"
	s.units[u.ID] = &u
	return s.units[u.ID], nil
}

func (s *Service) ListUnitsByBuilding(buildingID uint64) []*Unit {
	items := make([]*Unit, 0)
	for _, unit := range s.units {
		if unit.BuildingID == buildingID {
			items = append(items, unit)
		}
	}
	return items
}

func (s *Service) GetUnit(id uint64) (*Unit, error) {
	unit, ok := s.units[id]
	if !ok {
		return nil, ErrUnitNotFound
	}
	return unit, nil
}

func (s *Service) UpdateUnit(unit Unit) (*Unit, error) {
	if unit.ID == 0 || unit.Number == "" || unit.Type == "" { return nil, errors.New("unit id, number, and type are required") }
	if _, ok := s.units[unit.ID]; !ok { return nil, ErrUnitNotFound }
	unit.Status = s.units[unit.ID].Status
	s.units[unit.ID] = &unit
	return &unit, nil
}

func (s *Service) DeleteUnit(id uint64) error {
	if _, ok := s.units[id]; !ok { return ErrUnitNotFound }
	delete(s.units, id)
	return nil
}

func (s *Service) CreateTenant(t Tenant) (*Tenant, error) {
	if t.ID == 0 {
		t.ID = uint64(len(s.tenants) + 1)
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

func (s *Service) ListTenants(buildingID uint64) []*Tenant {
	items := make([]*Tenant, 0, len(s.tenants))
	for _, tenant := range s.tenants {
		if buildingID != 0 && tenant.BuildingID != buildingID {
			continue
		}
		items = append(items, tenant)
	}
	return items
}

func (s *Service) GetTenant(id uint64) (*Tenant, error) {
	tenant, ok := s.tenants[id]
	if !ok {
		return nil, ErrTenantNotFound
	}
	return tenant, nil
}

func (s *Service) CreateContract(c Contract) (*Contract, error) {
	if c.ID == 0 {
		c.ID = uint64(len(s.contracts) + 1)
	}
	if c.UnitID == 0 {
		return nil, errors.New("unit id is required")
	}
	if c.TenantID == 0 {
		return nil, errors.New("tenant id is required")
	}
	if c.ContractType == "" {
		return nil, errors.New("contract type is required")
	}

	s.contracts[c.ID] = &c
	if unit, ok := s.units[c.UnitID]; ok {
		unit.Status = "Occupied"
	}
	return s.contracts[c.ID], nil
}

func (s *Service) ListContracts(buildingID uint64) []*Contract {
	items := make([]*Contract, 0, len(s.contracts))
	for _, contract := range s.contracts {
		if buildingID != 0 {
			unit, ok := s.units[contract.UnitID]
			if !ok || unit.BuildingID != buildingID {
				continue
			}
		}
		items = append(items, contract)
	}
	return items
}

func (s *Service) GetContract(id uint64) (*Contract, error) {
	contract, ok := s.contracts[id]
	if !ok {
		return nil, ErrContractNotFound
	}
	return contract, nil
}

func (s *Service) CreateDocument(document Document) (*Document, error) {
	if document.ContractID == 0 || document.Name == "" || document.Path == "" {
		return nil, errors.New("contract id, document name, and path are required")
	}
	document.ID = uint64(len(s.documents) + 1)
	document.CreatedAt = time.Now()
	s.documents[document.ID] = &document
	return s.documents[document.ID], nil
}

func (s *Service) ListDocumentsByContract(contractID uint64) []*Document {
	items := make([]*Document, 0)
	for _, document := range s.documents {
		if document.ContractID == contractID {
			items = append(items, document)
		}
	}
	return items
}

func (s *Service) CreateInvoice(i Invoice) (*Invoice, error) {
	if i.ID == 0 {
		i.ID = uint64(len(s.invoices) + 1)
	}
	if i.ContractID == 0 {
		return nil, errors.New("contract id is required")
	}
	if i.TenantID == 0 {
		return nil, errors.New("tenant id is required")
	}
	if i.UnitID == 0 {
		return nil, errors.New("unit id is required")
	}
	if i.Number == "" {
		return nil, errors.New("invoice number is required")
	}

	s.invoices[i.ID] = &i
	return s.invoices[i.ID], nil
}

func (s *Service) ListInvoices(buildingID uint64) []*Invoice {
	items := make([]*Invoice, 0, len(s.invoices))
	for _, invoice := range s.invoices {
		if buildingID != 0 && invoice.BuildingID != buildingID {
			continue
		}
		items = append(items, invoice)
	}
	return items
}

func (s *Service) CreatePayment(payment Payment) (*Payment, error) {
	if payment.InvoiceID == 0 || payment.PaymentReference == "" || payment.Amount <= 0 || payment.PaymentMethod == "" {
		return nil, errors.New("invoice, payment reference, amount, and payment method are required")
	}
	payment.ID = uint64(len(s.payments) + 1)
	payment.CreatedAt = time.Now()
	s.payments[payment.ID] = &payment
	return s.payments[payment.ID], nil
}

func (s *Service) ListPayments(buildingID uint64) []*Payment {
	items := make([]*Payment, 0, len(s.payments))
	for _, payment := range s.payments {
		if buildingID != 0 && payment.BuildingID != buildingID {
			continue
		}
		items = append(items, payment)
	}
	return items
}

func (s *Service) DashboardSummary(buildingID uint64) DashboardSummary {
	summary := DashboardSummary{}
	if buildingID == 0 {
		summary.Buildings, summary.Floors, summary.Units = len(s.buildings), len(s.floors), len(s.units)
		summary.Tenants, summary.Contracts, summary.Invoices = len(s.tenants), len(s.contracts), len(s.invoices)
		return summary
	}
	if _, ok := s.buildings[buildingID]; ok {
		summary.Buildings = 1
	}
	for _, floor := range s.floors {
		if floor.BuildingID == buildingID {
			summary.Floors++
		}
	}
	for _, unit := range s.units {
		if unit.BuildingID == buildingID {
			summary.Units++
		}
	}
	for _, tenant := range s.tenants {
		if tenant.BuildingID == buildingID {
			summary.Tenants++
		}
	}
	for _, contract := range s.contracts {
		if unit, ok := s.units[contract.UnitID]; ok && unit.BuildingID == buildingID {
			summary.Contracts++
		}
	}
	for _, invoice := range s.invoices {
		if invoice.BuildingID == buildingID {
			summary.Invoices++
		}
	}
	return summary
}
