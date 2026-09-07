package buildings

import (
	"encoding/json"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// Handler exposes the core building, floor, and unit APIs.
type Handler struct {
	service ServiceAPI
}

type ServiceAPI interface {
	CreateBuilding(Building) (*Building, error)
	ListBuildings() []*Building
	CreateFloor(Floor) (*Floor, error)
	ListFloorsByBuilding(uint64) []*Floor
	CreateUnit(Unit) (*Unit, error)
	ListUnitsByBuilding(uint64) []*Unit
	GetUnit(uint64) (*Unit, error)
	UpdateUnit(Unit) (*Unit, error)
	DeleteUnit(uint64) error
	CreateTenant(Tenant) (*Tenant, error)
	ListTenants(uint64) []*Tenant
	GetTenant(uint64) (*Tenant, error)
	UpdateTenant(Tenant) (*Tenant, error)
	DeleteTenant(uint64) error
	CreateContract(Contract) (*Contract, error)
	ListContracts(uint64) []*Contract
	GetContract(uint64) (*Contract, error)
	CreateDocument(Document) (*Document, error)
	ListDocumentsByContract(uint64) []*Document
	CreateInvoice(Invoice) (*Invoice, error)
	ListInvoices(uint64) []*Invoice
	CreatePayment(Payment) (*Payment, error)
	ListPayments(uint64) []*Payment
	DashboardSummary(uint64) DashboardSummary
}

func NewHandler(service ServiceAPI) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/dashboard", h.dashboard)
	mux.HandleFunc("GET /api/v1/buildings", h.listBuildings)
	mux.HandleFunc("POST /api/v1/buildings", h.createBuilding)
	mux.HandleFunc("GET /api/v1/buildings/{id}/floors", h.listFloors)
	mux.HandleFunc("POST /api/v1/buildings/{id}/floors", h.createFloor)
	mux.HandleFunc("GET /api/v1/buildings/{id}/units", h.listUnits)
	mux.HandleFunc("POST /api/v1/buildings/{id}/units", h.createUnit)
	mux.HandleFunc("PUT /api/v1/units/{id}", h.updateUnit)
	mux.HandleFunc("DELETE /api/v1/units/{id}", h.deleteUnit)
	mux.HandleFunc("GET /api/v1/tenants", h.listTenants)
	mux.HandleFunc("POST /api/v1/tenants", h.createTenant)
	mux.HandleFunc("PUT /api/v1/tenants/{id}", h.updateTenant)
	mux.HandleFunc("DELETE /api/v1/tenants/{id}", h.deleteTenant)
	mux.HandleFunc("GET /api/v1/contracts", h.listContracts)
	mux.HandleFunc("POST /api/v1/contracts", h.createContract)
	mux.HandleFunc("GET /api/v1/contracts/{id}/preview", h.previewContract)
	mux.HandleFunc("POST /api/v1/contracts/{id}/invoices", h.generateInvoice)
	mux.HandleFunc("GET /api/v1/contracts/{id}/documents", h.listDocuments)
	mux.HandleFunc("POST /api/v1/contracts/{id}/documents", h.uploadDocument)
	mux.HandleFunc("GET /api/v1/invoices", h.listInvoices)
	mux.HandleFunc("POST /api/v1/invoices", h.createInvoice)
	mux.HandleFunc("GET /api/v1/payments", h.listPayments)
	mux.HandleFunc("POST /api/v1/payments", h.createPayment)
}

func (h *Handler) dashboard(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.DashboardSummary(queryID(request))})
}

func (h *Handler) listBuildings(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListBuildings()})
}

func (h *Handler) createBuilding(writer http.ResponseWriter, request *http.Request) {
	var building Building
	if err := json.NewDecoder(request.Body).Decode(&building); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid building payload")
		return
	}

	created, err := h.service.CreateBuilding(building)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) listFloors(writer http.ResponseWriter, request *http.Request) {
	buildingID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid building id")
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListFloorsByBuilding(buildingID)})
}

func (h *Handler) createFloor(writer http.ResponseWriter, request *http.Request) {
	buildingID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid building id")
		return
	}
	var floor Floor
	if err := json.NewDecoder(request.Body).Decode(&floor); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid floor payload")
		return
	}
	floor.BuildingID = buildingID

	created, err := h.service.CreateFloor(floor)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) listUnits(writer http.ResponseWriter, request *http.Request) {
	buildingID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid building id")
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListUnitsByBuilding(buildingID)})
}

func (h *Handler) createUnit(writer http.ResponseWriter, request *http.Request) {
	buildingID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid building id")
		return
	}
	var unit Unit
	if err := json.NewDecoder(request.Body).Decode(&unit); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid unit payload")
		return
	}
	unit.BuildingID = buildingID

	created, err := h.service.CreateUnit(unit)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) updateUnit(writer http.ResponseWriter, request *http.Request) {
	id, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid unit id")
		return
	}
	var unit Unit
	if err := json.NewDecoder(request.Body).Decode(&unit); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid unit payload")
		return
	}
	unit.ID = id
	updated, err := h.service.UpdateUnit(unit)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(updated)
}

func (h *Handler) deleteUnit(writer http.ResponseWriter, request *http.Request) {
	id, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid unit id")
		return
	}
	if err := h.service.DeleteUnit(id); err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listTenants(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListTenants(queryID(request))})
}

func (h *Handler) createTenant(writer http.ResponseWriter, request *http.Request) {
	var tenant Tenant
	if err := json.NewDecoder(request.Body).Decode(&tenant); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid tenant payload")
		return
	}

	created, err := h.service.CreateTenant(tenant)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) updateTenant(writer http.ResponseWriter, request *http.Request) {
	id, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid tenant id")
		return
	}
	var tenant Tenant
	if err := json.NewDecoder(request.Body).Decode(&tenant); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid tenant payload")
		return
	}
	tenant.ID = id
	updated, err := h.service.UpdateTenant(tenant)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(updated)
}

func (h *Handler) deleteTenant(writer http.ResponseWriter, request *http.Request) {
	id, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid tenant id")
		return
	}
	if err := h.service.DeleteTenant(id); err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listContracts(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListContracts(queryID(request))})
}

func (h *Handler) createContract(writer http.ResponseWriter, request *http.Request) {
	var contract Contract
	if err := json.NewDecoder(request.Body).Decode(&contract); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid contract payload")
		return
	}

	created, err := h.service.CreateContract(contract)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

var contractPreviewTemplate = template.Must(template.New("contract").Parse(`<!doctype html>
<html lang="sw"><head><meta charset="utf-8"><title>Mkataba wa upangishaji</title>
<style>body{font-family:Georgia,serif;line-height:1.6;max-width:800px;margin:48px auto;color:#111}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;margin:24px 0}td{border:1px solid #555;padding:9px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:80px}@media print{body{margin:20px}}</style></head>
<body><h1>{{if eq .Contract.ContractType "Commercial"}}MKATABA WA KUPANGISHA SEHEMU YA BIASHARA{{else}}MKATABA WA KUKODISHA NYUMBA MAKAZI{{end}}</h1>
<p>Mkataba huu ni kati ya mwenye jengo na mpangaji aliyesajiliwa hapa chini.</p><table>
<tr><td>MPANGAJI</td><td>{{.TenantName}}</td></tr><tr><td>AINA YA UPANGAJI</td><td>{{.Contract.ContractType}}</td></tr><tr><td>UNITI / CHUMBA</td><td>{{.UnitNumber}}</td></tr><tr><td>TAREHE YA KUANZA</td><td>{{.Contract.StartDate}}</td></tr><tr><td>TAREHE YA KUISHA</td><td>{{.Contract.EndDate}}</td></tr><tr><td>KODI YA PANGO</td><td>{{printf "%.2f" .Contract.MonthlyRent}}</td></tr><tr><td>JINSI YA KULIPA</td><td>{{.Contract.PaymentMethod}} - {{.Contract.PaymentFrequency}}</td></tr><tr><td>GHARAMA ZA HUDUMA</td><td>{{.Contract.UtilityResponsibility}}</td></tr></table>
<h2>MASHARTI YA MKATABA</h2><p style="white-space:pre-wrap">{{.Contract.Terms}}</p><p style="white-space:pre-wrap">{{.Contract.Notes}}</p><div class="signatures"><div>____________________________<br>MPANGAJI<br>Tarehe: ______________</div><div>____________________________<br>MWENYE JENGO<br>Tarehe: ______________</div></div></body></html>`))

func (h *Handler) previewContract(writer http.ResponseWriter, request *http.Request) {
	contractID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid contract id")
		return
	}
	contract, err := h.service.GetContract(contractID)
	if err != nil {
		writeJSONError(writer, http.StatusNotFound, err.Error())
		return
	}
	tenant, err := h.service.GetTenant(contract.TenantID)
	if err != nil {
		writeJSONError(writer, http.StatusNotFound, err.Error())
		return
	}
	unit, err := h.service.GetUnit(contract.UnitID)
	if err != nil {
		writeJSONError(writer, http.StatusNotFound, err.Error())
		return
	}
	tenantName := tenant.FullName
	if tenantName == "" {
		tenantName = tenant.CompanyName
	}
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := contractPreviewTemplate.Execute(writer, map[string]interface{}{"Contract": contract, "TenantName": tenantName, "UnitNumber": unit.Number}); err != nil {
		writeJSONError(writer, http.StatusInternalServerError, "render contract preview")
	}
}

func (h *Handler) generateInvoice(writer http.ResponseWriter, request *http.Request) {
	contractID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid contract id")
		return
	}
	contract, err := h.service.GetContract(contractID)
	if err != nil {
		writeJSONError(writer, http.StatusNotFound, err.Error())
		return
	}
	unit, err := h.service.GetUnit(contract.UnitID)
	if err != nil {
		writeJSONError(writer, http.StatusNotFound, err.Error())
		return
	}
	now := time.Now()
	created, err := h.service.CreateInvoice(Invoice{
		ContractID:  contract.ID,
		TenantID:    contract.TenantID,
		BuildingID:  unit.BuildingID,
		UnitID:      unit.ID,
		Number:      "INV-" + strconv.FormatUint(contract.ID, 10) + "-" + now.Format("20060102"),
		IssueDate:   now.Format("2006-01-02"),
		DueDate:     now.AddDate(0, 0, 7).Format("2006-01-02"),
		Amount:      contract.MonthlyRent,
		Description: "Rent invoice for unit " + unit.Number,
		Status:      "Pending",
	})
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) listDocuments(writer http.ResponseWriter, request *http.Request) {
	contractID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid contract id")
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListDocumentsByContract(contractID)})
}

func (h *Handler) uploadDocument(writer http.ResponseWriter, request *http.Request) {
	if err := request.ParseMultipartForm(10 << 20); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "document must be 10 MB or smaller")
		return
	}

	file, header, err := request.FormFile("file")
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, "a document file is required")
		return
	}
	defer file.Close()

	extension := filepath.Ext(header.Filename)
	if extension != ".pdf" && extension != ".doc" && extension != ".docx" {
		writeJSONError(writer, http.StatusBadRequest, "only PDF and Word documents are allowed")
		return
	}

	directory := os.Getenv("UPLOAD_DIR")
	if directory == "" {
		directory = "uploads"
	}
	if err := os.MkdirAll(directory, 0755); err != nil {
		writeJSONError(writer, http.StatusInternalServerError, "create upload directory")
		return
	}
	filename := "contract-" + strconv.FormatInt(time.Now().UnixNano(), 10) + extension
	path := filepath.Join(directory, filename)
	destination, err := os.Create(path)
	if err != nil {
		writeJSONError(writer, http.StatusInternalServerError, "create document")
		return
	}
	_, copyErr := io.Copy(destination, file)
	closeErr := destination.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(path)
		writeJSONError(writer, http.StatusInternalServerError, "save document")
		return
	}

	name := request.FormValue("name")
	if name == "" {
		name = header.Filename
	}
	contractID, ok := pathID(request)
	if !ok {
		writeJSONError(writer, http.StatusBadRequest, "invalid contract id")
		return
	}
	document, err := h.service.CreateDocument(Document{ContractID: contractID, Name: name, OriginalName: header.Filename, Path: "/uploads/" + filename, MimeType: header.Header.Get("Content-Type")})
	if err != nil {
		_ = os.Remove(path)
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(document)
}

func (h *Handler) listInvoices(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListInvoices(queryID(request))})
}

func (h *Handler) createInvoice(writer http.ResponseWriter, request *http.Request) {
	var invoice Invoice
	if err := json.NewDecoder(request.Body).Decode(&invoice); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid invoice payload")
		return
	}

	created, err := h.service.CreateInvoice(invoice)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func (h *Handler) listPayments(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(map[string]interface{}{"data": h.service.ListPayments(queryID(request))})
}

func pathID(request *http.Request) (uint64, bool) {
	id, err := strconv.ParseUint(request.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func queryID(request *http.Request) uint64 {
	id, _ := strconv.ParseUint(request.URL.Query().Get("building_id"), 10, 64)
	return id
}

func (h *Handler) createPayment(writer http.ResponseWriter, request *http.Request) {
	var payment Payment
	if err := json.NewDecoder(request.Body).Decode(&payment); err != nil {
		writeJSONError(writer, http.StatusBadRequest, "invalid payment payload")
		return
	}
	created, err := h.service.CreatePayment(payment)
	if err != nil {
		writeJSONError(writer, http.StatusBadRequest, err.Error())
		return
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusCreated)
	json.NewEncoder(writer).Encode(created)
}

func writeJSONError(writer http.ResponseWriter, code int, msg string) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(code)
	json.NewEncoder(writer).Encode(map[string]string{"error": msg})
}
