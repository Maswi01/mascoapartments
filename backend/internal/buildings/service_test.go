package buildings

import "testing"

func TestServiceTracksPortfolioAndDashboardSummary(t *testing.T) {
	service := NewService()

	building, err := service.CreateBuilding(Building{
		Name:    "Mlimani Apartments",
		Code:    "MLM-01",
		Address: "Dar es Salaam",
		Floors:  2,
		Status:  "Active",
	})
	if err != nil {
		t.Fatalf("create building: %v", err)
	}

	floor, err := service.CreateFloor(Floor{
		BuildingID: building.ID,
		Name:       "Ground Floor",
	})
	if err != nil {
		t.Fatalf("create floor: %v", err)
	}

	unit, err := service.CreateUnit(Unit{
		BuildingID: building.ID,
		FloorID:    floor.ID,
		Number:     "A1",
		Type:       "Residential",
		Status:     "Vacant",
	})
	if err != nil {
		t.Fatalf("create unit: %v", err)
	}

	tenant, err := service.CreateTenant(Tenant{
		Type:     "Person",
		FullName: "Jane Doe",
		Phone:    "+255700000001",
		Email:    "jane@example.com",
	})
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	contract, err := service.CreateContract(Contract{
		BuildingID:   building.ID,
		UnitID:       unit.ID,
		TenantID:     tenant.ID,
		ContractType: "Residential",
		StartDate:    "2026-01-01",
		EndDate:      "2026-12-31",
		MonthlyRent:  1200,
		Status:       "Active",
	})
	if err != nil {
		t.Fatalf("create contract: %v", err)
	}

	_, err = service.CreateInvoice(Invoice{
		ContractID: contract.ID,
		TenantID:   tenant.ID,
		UnitID:     unit.ID,
		Number:     "INV-001",
		IssueDate:  "2026-09-01",
		DueDate:    "2026-09-10",
		Amount:     1200,
		Status:     "Pending",
	})
	if err != nil {
		t.Fatalf("create invoice: %v", err)
	}

	document, err := service.CreateDocument(Document{
		ContractID:   contract.ID,
		Name:         "Signed residential lease",
		OriginalName: "lease.docx",
		Path:         "/uploads/contract-lease.docx",
		MimeType:     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	})
	if err != nil {
		t.Fatalf("create document: %v", err)
	}
	if document.ID == 0 || len(service.ListDocumentsByContract(contract.ID)) != 1 {
		t.Fatal("expected contract document to be stored")
	}

	summary := service.DashboardSummary(0)
	if summary.Buildings != 1 {
		t.Fatalf("expected 1 building, got %d", summary.Buildings)
	}
	if summary.Tenants != 1 {
		t.Fatalf("expected 1 tenant, got %d", summary.Tenants)
	}
	if summary.Contracts != 1 {
		t.Fatalf("expected 1 contract, got %d", summary.Contracts)
	}
	if summary.Invoices != 1 {
		t.Fatalf("expected 1 invoice, got %d", summary.Invoices)
	}
	if summary.Units != 1 {
		t.Fatalf("expected 1 unit, got %d", summary.Units)
	}
}

func TestServiceRejectsDeletingTenantWithContract(t *testing.T) {
	service := NewService()
	tenant, err := service.CreateTenant(Tenant{Type: "Person", FullName: "Rented Tenant"})
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	service.contracts[1] = &Contract{ID: 1, TenantID: tenant.ID, UnitID: 1}

	if err := service.DeleteTenant(tenant.ID); err != ErrTenantHasContracts {
		t.Fatalf("expected rented tenant delete to fail, got %v", err)
	}
	if _, err := service.GetTenant(tenant.ID); err != nil {
		t.Fatalf("tenant should remain after rejected delete: %v", err)
	}
}

func TestServiceRejectsDeletingContractWithInvoice(t *testing.T) {
	service := NewService()
	service.contracts[1] = &Contract{ID: 1, UnitID: 1, TenantID: 1}
	service.invoices[1] = &Invoice{ID: 1, ContractID: 1}

	if err := service.DeleteContract(1); err != ErrContractHasRecords {
		t.Fatalf("expected contract delete to fail, got %v", err)
	}
	if _, err := service.GetContract(1); err != nil {
		t.Fatalf("contract should remain after rejected delete: %v", err)
	}
}

func TestServicePaymentUsesInvoiceContextAndRejectsOverpayment(t *testing.T) {
	service := NewService()
	service.invoices[1] = &Invoice{ID: 1, TenantID: 2, BuildingID: 3, UnitID: 4, Amount: 1000, Status: "Pending"}

	payment, err := service.CreatePayment(Payment{InvoiceID: 1, Amount: 600, PaymentMethod: "Cash", PaymentReference: "PAY-1"})
	if err != nil {
		t.Fatalf("create payment: %v", err)
	}
	if payment.TenantID != 2 || payment.BuildingID != 3 || payment.UnitID != 4 {
		t.Fatalf("expected invoice context on payment, got tenant=%d building=%d unit=%d", payment.TenantID, payment.BuildingID, payment.UnitID)
	}
	if _, err := service.CreatePayment(Payment{InvoiceID: 1, Amount: 500, PaymentMethod: "Cash", PaymentReference: "PAY-2"}); err == nil {
		t.Fatal("expected overpayment to be rejected")
	}
}
