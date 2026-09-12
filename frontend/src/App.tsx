import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Swal from "sweetalert2";
import heroImage from "./assets/hero.png";
import "./App.css";

const apiURL = import.meta.env.VITE_API_URL ?? "http://localhost:6400/api/v1";

const formatAmount = (value: string | number) => {
  const raw = String(value).replace(/[^0-9.]/g, "");
  const [integerPart, decimalPart] = raw.split(".");
  const formattedInteger = (integerPart || "0")
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart === undefined
    ? formattedInteger
    : `${formattedInteger}.${decimalPart.slice(0, 2)}`;
};

const amountNumber = (value: string) => Number(value.replace(/,/g, "")) || 0;

const defaultForm = {
  name: "",
  code: "",
  address: "",
  description: "",
  floors: "2",
  status: "Active",
};

const defaultTenantForm = {
  type: "Person",
  full_name: "",
  company_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  id_number: "",
  notes: "",
};

const defaultUnitForm = {
  number: "",
  floor_id: "",
  type: "Residential",
  description: "",
  status: "Vacant",
  base_rent: "",
};

const defaultContractForm = {
  tenant_id: "",
  unit_id: "",
  contract_type: "Residential",
  start_date: "",
  end_date: "",
  monthly_rent: "0",
  period: "1",
  prepaid_amount: "0",
  payment_method: "Bank Transfer",
  payment_frequency: "Monthly",
  utility_responsibility: "Tenant pays electricity and water",
  terms: "",
  status: "Active",
  notes: "",
};

const defaultPaymentForm = {
  invoice_id: "",
  amount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: "Bank Transfer",
  payment_reference: "",
  receipt_number: "",
  notes: "",
};

const defaultProformaForm = {
  unit_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  period: "1",
  prepaid_amount: "0",
  issue_date: new Date().toISOString().slice(0, 10),
};

const defaultContractUpgradeForm = {
  period: "1",
  prepaid_amount: "0",
  payment_date: new Date().toISOString().slice(0, 10),
};

type BuildingRecord = {
  id: string;
  name: string;
  code: string;
  address: string;
  description?: string;
  floors: number;
  status: string;
};

type TenantRecord = {
  id: string;
  building_id: string;
  type: string;
  full_name?: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  id_number?: string;
  registration_ref?: string;
  notes?: string;
};

type UnitRecord = {
  id: string;
  building_id: string;
  number: string;
  type: string;
  status: string;
  floor_id?: string;
  base_rent: number;
};

type FloorRecord = { id: string; name: string };

type ContractRecord = {
  id: string;
  building_id: number;
  unit_id: string;
  tenant_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  payment_method?: string;
  payment_frequency?: string;
  utility_responsibility?: string;
  status: string;
};

type InvoiceRecord = {
  id: string;
  contract_id: string;
  building_id: number;
  number: string;
  amount: number;
  status: string;
};

type PaymentRecord = {
  id: string;
  invoice_id: string;
  payment_reference: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number?: string;
  building_id: number;
};

type Session = {
  token: string;
  user: {
    username: string;
    full_name: string;
    roles: string[];
  };
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
};
type View =
  | "home"
  | "buildings"
  | "units"
  | "tenants"
  | "contracts"
  | "invoices"
  | "payments"
  | "registration"
  | "reports"
  | "settings";

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem("masco-session");
    return stored ? (JSON.parse(stored) as Session) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [tenantForm, setTenantForm] = useState(defaultTenantForm);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantTypeFilter, setTenantTypeFilter] = useState("All");
  const [tenantPage, setTenantPage] = useState(1);
  const [tenantPageSize, setTenantPageSize] = useState(10);
  const [editingTenantID, setEditingTenantID] = useState<string | null>(null);
  const [unitRows, setUnitRows] = useState([defaultUnitForm]);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitTypeFilter, setUnitTypeFilter] = useState("All");
  const [unitStatusFilter, setUnitStatusFilter] = useState("All");
  const [unitFloorFilter, setUnitFloorFilter] = useState("All");
  const [unitPage, setUnitPage] = useState(1);
  const [unitPageSize, setUnitPageSize] = useState(10);
  const [unitPageMode, setUnitPageMode] = useState<"list" | "create" | "rent">(() =>
    window.location.pathname === "/units/new" ? "create" : window.location.pathname.includes("/rent") ? "rent" : "list",
  );
  const [tenantPageMode, setTenantPageMode] = useState<"list" | "create" | "edit" | "invoice">(() =>
    window.location.pathname === "/tenants/new" ? "create" : window.location.pathname === "/tenants/edit" ? "edit" : window.location.pathname.includes("/invoice") ? "invoice" : "list",
  );
  const [proformaTenantID, setProformaTenantID] = useState<string | null>(null);
  const [proformaForm, setProformaForm] = useState(defaultProformaForm);
  const [editingUnitID, setEditingUnitID] = useState<string | null>(null);
  const [rentUnitID, setRentUnitID] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState(defaultContractForm);
  const [contractPageMode, setContractPageMode] = useState<"list" | "create" | "upgrade" | "document">("list");
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("All");
  const [contractPage, setContractPage] = useState(1);
  const [contractPageSize, setContractPageSize] = useState(10);
  const [upgradingContractID, setUpgradingContractID] = useState<string | null>(null);
  const [contractUpgradeForm, setContractUpgradeForm] = useState(defaultContractUpgradeForm);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [documentContractID, setDocumentContractID] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [view, setView] = useState<View>("home");
  const [selectedBuildingID, setSelectedBuildingID] = useState(
    () => localStorage.getItem("masco-building-id") ?? "hq",
  );
  const [formError, setFormError] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: session?.user.full_name ?? "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });

  const goTo = (path: string) => {
    window.history.pushState({}, "", path);
    if (path === "/units/new") setUnitPageMode("create");
    if (path === "/units") setUnitPageMode("list");
    if (path.includes("/rent")) setUnitPageMode("rent");
    if (path === "/tenants/new") setTenantPageMode("create");
    if (path === "/tenants") setTenantPageMode("list");
    if (path === "/tenants/edit") setTenantPageMode("edit");
    if (path.includes("/invoice")) setTenantPageMode("invoice");
    if (path === "/contracts") setContractPageMode("list");
    if (path === "/contracts/new") setContractPageMode("create");
    if (path.includes("/upgrade")) setContractPageMode("upgrade");
    if (path.includes("/document")) setContractPageMode("document");
  };

  const logout = () => {
    localStorage.removeItem("masco-session");
    setSession(null);
  };

  const sessionExpiredRef = useRef(false);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiURL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session?.token ?? ""}`,
      },
    });
    if (response.status === 401 && !sessionExpiredRef.current) {
      sessionExpiredRef.current = true;
      logout();
      void Swal.fire({
        icon: "info",
        title: "Session expired",
        text: "Please sign in again.",
        confirmButtonColor: "#133d32",
      });
    }
    return response;
  };

  const showRequestError = async (response: Response, fallback: string) => {
    const payload = (await response
      .json()
      .catch(() => ({ error: fallback }))) as { error?: string };
    await Swal.fire({
      icon: "error",
      title: "Could not complete request",
      text: payload.error ?? fallback,
      confirmButtonColor: "#133d32",
    });
  };

  const showSuccess = (title: string) =>
    Swal.fire({
      icon: "success",
      title,
      timer: 1600,
      showConfirmButton: false,
    });

  const readData = async (path: string) => {
    const response = await apiFetch(path);
    if (!response.ok) {
      throw new Error(`${path}: ${response.status}`);
    }
    return response.json() as Promise<{ data?: unknown }>;
  };

  const loadData = async () => {
    if (!session) return;
    try {
      const contextQuery =
        selectedBuildingID === "hq" ? "" : `?building_id=${selectedBuildingID}`;
      const [buildingData, tenantData, contractData, invoiceData, paymentData] =
        await Promise.all([
          readData("/buildings"),
          readData(`/tenants${contextQuery}`),
          readData(`/contracts${contextQuery}`),
          readData(`/invoices${contextQuery}`),
          readData(`/payments${contextQuery}`),
        ]);

      const nextBuildings = (buildingData.data ?? []) as BuildingRecord[];
      setBuildings(nextBuildings);
      if (
        selectedBuildingID !== "hq" &&
        !nextBuildings.some(
          (building) => String(building.id) === selectedBuildingID,
        )
      ) {
        switchBuilding("hq");
        return;
      }
      setTenants((tenantData.data ?? []) as TenantRecord[]);
      setContracts((contractData.data ?? []) as ContractRecord[]);
      setInvoices((invoiceData.data ?? []) as InvoiceRecord[]);
      setPayments((paymentData.data ?? []) as PaymentRecord[]);
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Could not load portfolio data",
        text: "Check the API response and database schema. The failed request is available in the browser network panel.",
        confirmButtonColor: "#133d32",
      });
    }
  };

  useEffect(() => {
    if (session) void loadData();
  }, [session, selectedBuildingID]);

  useEffect(() => {
    if (!session) return;
    void apiFetch("/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((user) => {
        if (user)
          setProfileForm({ full_name: user.full_name, email: user.email });
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    localStorage.setItem("masco-building-id", selectedBuildingID);
    if (!session || selectedBuildingID === "hq") {
      setUnits([]);
      setFloors([]);
      return;
    }
    void Promise.all([
      apiFetch(`/buildings/${selectedBuildingID}/units`),
      apiFetch(`/buildings/${selectedBuildingID}/floors`),
    ])
      .then(async ([unitsResponse, floorsResponse]) => {
        if (!unitsResponse.ok || !floorsResponse.ok)
          throw new Error("Could not load building data");
        const [unitsPayload, floorsPayload] = await Promise.all([
          unitsResponse.json(),
          floorsResponse.json(),
        ]);
        setUnits(unitsPayload.data ?? []);
        setFloors(floorsPayload.data ?? []);
      })
      .catch(() => {
        setUnits([]);
        setFloors([]);
      });
  }, [selectedBuildingID, session]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/units\/(\d+)\/rent$/);
    if (!match || units.length === 0) return;
    const unit = units.find((item) => String(item.id) === match[1]);
    if (unit) {
      setRentUnitID(unit.id);
      setContractForm((current) => ({ ...current, unit_id: unit.id, contract_type: unit.type, monthly_rent: formatAmount(unit.base_rent) }));
    }
  }, [units]);

  useEffect(() => {
    if (view !== "registration" || !session) return;
    void Promise.all([apiFetch("/auth/users"), apiFetch("/auth/roles")])
      .then(async ([usersResponse, rolesResponse]) => {
        const usersPayload = await usersResponse.json();
        const rolesPayload = await rolesResponse.json();
        setAdminUsers(usersPayload.data ?? []);
        setRoles(rolesPayload.data ?? []);
      })
      .catch(() => {});
  }, [view, session]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    const response = await fetch(`${apiURL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });
    if (!response.ok) {
      setLoginError("Invalid username or password.");
      await showRequestError(response, "Invalid username or password.");
      return;
    }
    const nextSession = (await response.json()) as Session;
    localStorage.setItem("masco-session", JSON.stringify(nextSession));
    sessionExpiredRef.current = false;
    setSession(nextSession);
    void showSuccess("Welcome back");
  };

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleTenantChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setTenantForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const editTenant = (tenant: TenantRecord) => {
    setEditingTenantID(tenant.id);
    setTenantForm({
      ...defaultTenantForm,
      type: tenant.type,
      full_name: tenant.full_name ?? "",
      company_name: tenant.company_name ?? "",
      contact_person: tenant.contact_person ?? "",
      phone: tenant.phone ?? "",
      email: tenant.email ?? "",
      address: tenant.address ?? "",
      id_number: tenant.id_number ?? "",
      notes: tenant.notes ?? "",
    });
    goTo("/tenants/edit");
  };

  const deleteTenant = async (tenant: TenantRecord) => {
    const rentedUnits = contracts
      .filter((contract) => String(contract.tenant_id) === String(tenant.id))
      .map((contract) => units.find((unit) => String(unit.id) === String(contract.unit_id))?.number)
      .filter(Boolean);
    if (rentedUnits.length > 0) {
      await Swal.fire({
        icon: "info",
        title: "Tenant cannot be deleted",
        text: `This tenant has rented unit${rentedUnits.length === 1 ? "" : "s"}: ${rentedUnits.join(", ")}.`,
        confirmButtonColor: "#133d32",
      });
      return;
    }
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${tenant.full_name || tenant.company_name || "tenant"}?`,
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/tenants/${tenant.id}`, { method: "DELETE" });
    if (!response.ok) {
      await showRequestError(response, "Could not delete tenant.");
      return;
    }
    setTenants((current) => current.filter((item) => item.id !== tenant.id));
    void showSuccess("Tenant deleted");
  };

  const updateUnitRow = (rowIndex: number, field: string, value: string) => {
    setUnitRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addUnitRow = () =>
    setUnitRows((current) => [...current, { ...defaultUnitForm }]);

  const removeUnitRow = (rowIndex: number) =>
    setUnitRows((current) =>
      current.length === 1
        ? current
        : current.filter((_, index) => index !== rowIndex),
    );

  const editUnit = (unit: UnitRecord) => {
    setEditingUnitID(unit.id);
    setUnitRows([{ number: unit.number, floor_id: unit.floor_id ?? "", type: unit.type, description: "", status: unit.status, base_rent: formatAmount(unit.base_rent) }]);
    goTo(`/units/edit/${unit.id}`);
  };

  const rentUnit = (unit: UnitRecord) => {
    setRentUnitID(unit.id);
    setContractForm((current) => ({ ...current, unit_id: unit.id, contract_type: unit.type, monthly_rent: formatAmount(unit.base_rent), start_date: new Date().toISOString().slice(0, 10), period: "1", prepaid_amount: "0" }));
    goTo(`/units/${unit.id}/rent`);
  };

  const deleteUnit = async (unit: UnitRecord) => {
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete ${unit.number}?`,
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/units/${unit.id}`, { method: "DELETE" });
    if (!response.ok) {
      await showRequestError(response, "Could not delete unit.");
      return;
    }
    setUnits((current) => current.filter((item) => item.id !== unit.id));
    void showSuccess("Unit deleted");
  };

  const handleUnitSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedBuildingID === "hq") {
      await Swal.fire({
        icon: "info",
        title: "Choose a building first",
        text: "Select the building this unit belongs to from the portfolio context selector.",
        confirmButtonColor: "#133d32",
      });
      return;
    }
    if (editingUnitID) {
      const row = unitRows[0];
      const response = await apiFetch(`/units/${editingUnitID}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...row, id: Number(editingUnitID), building_id: Number(selectedBuildingID), floor_id: Number(row.floor_id) || 0, base_rent: amountNumber(row.base_rent) }) });
      if (!response.ok) { await showRequestError(response, "Could not update unit."); return; }
      const payload = await apiFetch(`/buildings/${selectedBuildingID}/units`);
      const data = await payload.json();
      setUnits(data.data ?? []);
      setEditingUnitID(null);
      setUnitRows([{ ...defaultUnitForm }]);
      goTo("/units");
      void showSuccess("Unit updated");
      return;
    }
    for (const row of unitRows) {
      const response = await apiFetch(
        `/buildings/${selectedBuildingID}/units`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...row,
            floor_id: Number(row.floor_id) || 0,
            base_rent: amountNumber(row.base_rent),
          }),
        },
      );
      if (!response.ok) {
        await showRequestError(response, "Could not save unit.");
        return;
      }
    }
    const payload = await apiFetch(`/buildings/${selectedBuildingID}/units`);
    const data = await payload.json();
    setUnits(data.data ?? []);
    setUnitRows([{ ...defaultUnitForm }]);
    goTo("/units");
    void showSuccess("Unit saved");
  };

  const handleContractChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setContractForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const rentStartDate = contractForm.start_date ? new Date(`${contractForm.start_date}T00:00:00`) : null;
  const rentPeriod = Math.max(1, Number(contractForm.period) || 1);
  const calculatedEndDate = rentStartDate ? new Date(rentStartDate.getFullYear(), rentStartDate.getMonth() + rentPeriod, rentStartDate.getDate()).toISOString().slice(0, 10) : "";
  const totalRent = amountNumber(contractForm.monthly_rent) * rentPeriod;
  const prepaidAmount = amountNumber(contractForm.prepaid_amount);
  const balanceAmount = Math.max(0, totalRent - prepaidAmount);

  const handlePaymentChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setPaymentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setFormError("");

    const response = await apiFetch("/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        floors: Number(form.floors),
      }),
    });

    if (response.ok) {
      await loadData();
      setForm(defaultForm);
      setView("home");
      void showSuccess("Building saved");
    } else {
      const error = (await response
        .json()
        .catch(() => ({ error: "Could not save building." }))) as {
        error?: string;
      };
      setFormError(error.error ?? "Could not save building.");
      await Swal.fire({
        icon: "error",
        title: "Building not saved",
        text: error.error ?? "Could not save building.",
        confirmButtonColor: "#133d32",
      });
    }
  };

  const handleTenantSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const response = await apiFetch(
      editingTenantID ? `/tenants/${editingTenantID}` : "/tenants",
      {
      method: editingTenantID ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...tenantForm,
        building_id: Number(selectedBuildingID),
      }),
      },
    );

    if (response.ok) {
      const createdTenant = (await response.json()) as TenantRecord;
      await loadData();
      setTenantForm(defaultTenantForm);
      setEditingTenantID(null);
      if (editingTenantID) {
        goTo("/tenants");
        void showSuccess("Tenant updated");
      } else {
        setProformaTenantID(createdTenant.id);
        setProformaForm(defaultProformaForm);
        goTo(`/tenants/${createdTenant.id}/invoice`);
        void showSuccess("Tenant saved. Prepare the invoice.");
      }
    } else {
      await showRequestError(response, "Could not save tenant.");
    }
  };

  const handleProformaChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setProformaForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleProformaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedUnit = units.find((unit) => String(unit.id) === proformaForm.unit_id);
    if (!selectedUnit || !proformaTenantID) return;
    const period = Math.max(1, Number(proformaForm.period) || 1);
    const startDate = new Date(`${proformaForm.start_date}T00:00:00`);
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + period,
      startDate.getDate(),
    ).toISOString().slice(0, 10);
    const contractResponse = await apiFetch("/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: Number(proformaTenantID),
        unit_id: Number(selectedUnit.id),
        contract_type: selectedUnit.type,
        start_date: proformaForm.start_date,
        end_date: endDate,
        monthly_rent: selectedUnit.base_rent,
        payment_frequency: "Monthly",
        status: "Active",
        notes: `Prepaid amount: ${formatAmount(proformaForm.prepaid_amount)}`,
      }),
    });
    if (!contractResponse.ok) {
      await showRequestError(contractResponse, "Could not create the tenant contract.");
      return;
    }
    const contract = (await contractResponse.json()) as ContractRecord;
    const invoiceResponse = await apiFetch(`/contracts/${contract.id}/invoices`, {
      method: "POST",
    });
    if (!invoiceResponse.ok) {
      await showRequestError(invoiceResponse, "Could not generate the proforma invoice.");
      return;
    }
    await loadData();
    void showSuccess("Proforma invoice generated");
    setView("tenants");
    goTo("/tenants");
  };

  const handleContractSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const rentNotes = rentUnitID && amountNumber(contractForm.prepaid_amount) > 0
      ? `${contractForm.notes}${contractForm.notes ? "\n" : ""}Prepaid amount: ${formatAmount(contractForm.prepaid_amount)}`
      : contractForm.notes
    const response = await apiFetch("/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...contractForm,
        tenant_id: Number(contractForm.tenant_id),
        unit_id: Number(contractForm.unit_id),
        monthly_rent: amountNumber(contractForm.monthly_rent),
        end_date: rentUnitID ? calculatedEndDate : contractForm.end_date,
        notes: rentNotes,
      }),
    });

    if (response.ok) {
      await loadData();
      setContractForm(defaultContractForm);
      if (rentUnitID) {
        setRentUnitID(null)
        goTo('/units')
      } else {
        goTo("/contracts");
      }
      void showSuccess("Contract saved");
    } else {
      await showRequestError(response, "Could not save contract.");
    }
  };

  const terminateContract = async (contract: ContractRecord) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Terminate contract?",
      text: "The unit will become available for rent.",
      showCancelButton: true,
      confirmButtonText: "Terminate",
      confirmButtonColor: "#d9574f",
    });
    if (!result.isConfirmed) return;
    const response = await apiFetch(`/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contract, status: "Cancelled" }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not terminate contract.");
      return;
    }
    await loadData();
    void showSuccess("Contract terminated");
  };

  const upgradeContract = (contract: ContractRecord) => {
    setUpgradingContractID(contract.id);
    setContractUpgradeForm(defaultContractUpgradeForm);
    goTo(`/contracts/${contract.id}/upgrade`);
  };

  const handleContractUpgradeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const contract = contracts.find((item) => item.id === upgradingContractID);
    if (!contract) return;
    const period = Math.max(1, Number(contractUpgradeForm.period) || 1);
    const currentEndDate = new Date(`${contract.end_date}T00:00:00`);
    const endDate = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth() + period, currentEndDate.getDate()).toISOString().slice(0, 10);
    const response = await apiFetch(`/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contract, end_date: endDate, status: "Active" }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not upgrade contract.");
      return;
    }
    await loadData();
    setContractPageMode("list");
    goTo("/contracts");
    void showSuccess("Contract upgraded");
  };

  const handleGenerateInvoice = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/invoices`, {
      method: "POST",
    });
    if (!response.ok) {
      await showRequestError(response, "Could not generate invoice.");
      return;
    }
    await loadData();
    void showSuccess("Invoice generated");
  };

  const payContractInvoice = (contractID: string) => {
    const invoice = invoices.find((item) => String(item.contract_id) === String(contractID));
    if (!invoice) {
      void Swal.fire({ icon: "info", title: "No invoice yet", text: "Generate an invoice for this contract before recording payment.", confirmButtonColor: "#133d32" });
      return;
    }
    setPaymentForm((current) => ({ ...current, invoice_id: invoice.id, amount: formatAmount(invoice.amount) }));
    setView("payments");
  };

  const handlePaymentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...paymentForm,
        invoice_id: Number(paymentForm.invoice_id),
        amount: amountNumber(paymentForm.amount),
      }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not record payment.");
      return;
    }
    await loadData();
    setPaymentForm(defaultPaymentForm);
    void showSuccess("Payment recorded");
  };

  const handleLogout = async () => {
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Sign out?",
      showCancelButton: true,
      confirmButtonText: "Sign out",
      confirmButtonColor: "#133d32",
    });
    if (!confirmation.isConfirmed) return;
    logout();
  };

  const handleProfileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not update profile.");
      return;
    }
    const updated = (await response.json()) as Session["user"];
    if (session) {
      const nextSession = {
        ...session,
        user: { ...session.user, full_name: updated.full_name },
      };
      localStorage.setItem("masco-session", JSON.stringify(nextSession));
      setSession(nextSession);
    }
    void showSuccess("Profile updated");
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      await Swal.fire({
        icon: "error",
        title: "Passwords do not match",
        confirmButtonColor: "#133d32",
      });
      return;
    }
    const response = await apiFetch("/auth/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not change password.");
      return;
    }
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    void showSuccess("Password changed");
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch("/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUserForm),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not register user.");
      return;
    }
    setNewUserForm({ username: "", email: "", full_name: "", password: "" });
    setView("registration");
    void showSuccess("User registered");
  };

  const updateUserStatus = async (userID: number, status: string) => {
    const response = await apiFetch(`/auth/users/${userID}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not update user.");
      return;
    }
    setAdminUsers((current) =>
      current.map((user) => (user.id === userID ? { ...user, status } : user)),
    );
    void showSuccess("User updated");
  };

  const assignUserRole = async (userID: number, role: string) => {
    const response = await apiFetch(`/auth/users/${userID}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      await showRequestError(response, "Could not assign role.");
      return;
    }
    setAdminUsers((current) =>
      current.map((user) =>
        user.id === userID && !user.roles.includes(role)
          ? { ...user, roles: [...user.roles, role] }
          : user,
      ),
    );
    void showSuccess("Role assigned");
  };

  const handleDocumentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!documentContractID || !documentFile) return;

    const payload = new FormData();
    payload.append("file", documentFile);
    payload.append("name", documentName || documentFile.name);
    const response = await apiFetch(
      `/contracts/${documentContractID}/documents`,
      {
        method: "POST",
        body: payload,
      },
    );

    if (response.ok) {
      setDocumentContractID("");
      setDocumentName("");
      setDocumentFile(null);
      goTo("/contracts");
      void showSuccess("Signed contract uploaded");
    } else {
      await showRequestError(response, "Could not upload the document.");
    }
  };

  const handleContractPreview = async (contractID: string) => {
    const response = await apiFetch(`/contracts/${contractID}/preview`);
    if (!response.ok) {
      await showRequestError(response, "Could not generate contract.");
      return;
    }
    const documentURL = URL.createObjectURL(await response.blob());
    window.open(documentURL, "_blank", "noopener,noreferrer");
  };

  const handleContractView = async (contractID: string) => {
    const documentsResponse = await apiFetch(`/contracts/${contractID}/documents`);
    if (!documentsResponse.ok) {
      await showRequestError(documentsResponse, "Could not load contract documents.");
      return;
    }
    const payload = (await documentsResponse.json()) as { data?: unknown[] };
    if (!payload.data?.length) {
      await handleContractPreview(contractID);
      return;
    }
    const response = await apiFetch(`/contracts/${contractID}/documents/latest`);
    if (!response.ok) {
      await showRequestError(response, "Could not open the signed contract.");
      return;
    }
    const documentURL = URL.createObjectURL(await response.blob());
    window.open(documentURL, "_blank", "noopener,noreferrer");
  };

  const attachSignedContract = (contractID: string) => {
    setDocumentContractID(contractID);
    setDocumentName("");
    setDocumentFile(null);
    goTo(`/contracts/${contractID}/document`);
  };

  if (!session) {
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="login-brand">
            <span className="brand-mark">M</span>
            <span>
              Masco<span>Rent</span>
            </span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">Property operations</p>
            <h1>
              Every building,
              <br />
              under control.
            </h1>
            <p>
              One quiet workspace for occupancy, tenants, contracts, and the
              details that keep each property moving.
            </p>
          </div>
          <img
            className="login-illustration"
            src={heroImage}
            alt="Layered building platform"
          />
          <p className="story-footer">MASCO APARTMENTS</p>
        </section>
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="login-heading">
            <p className="eyebrow">Welcome back</p>
            <h1>Sign in to your workspace</h1>
            <p>Use your MascoRent account to continue.</p>
          </div>
          <label>
            Username or email
            <input
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              autoComplete="username"
              placeholder="name@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  const selectedBuilding = buildings.find(
    (building) => String(building.id) === selectedBuildingID,
  );
  const pageTitle: Record<View, string> = {
    home: selectedBuildingID === "hq" ? "Home" : "Branch home",
    buildings: "Buildings",
    units: "Units",
    tenants: "Tenants",
    contracts: "Contracts",
    invoices: "Invoices",
    payments: "Payments",
    registration: "Registration",
    reports: "Reports",
    settings: "Settings",
  };

  const filteredUnits = units.filter((unit) => {
    const search = unitSearch.toLowerCase();
    return (
      (!search || unit.number.toLowerCase().includes(search)) &&
      (unitTypeFilter === "All" || unit.type === unitTypeFilter) &&
      (unitStatusFilter === "All" || unit.status === unitStatusFilter) &&
      (unitFloorFilter === "All" ||
        String(unit.floor_id ?? "") === unitFloorFilter)
    );
  });
  const unitPageCount = Math.max(
    1,
    Math.ceil(filteredUnits.length / unitPageSize),
  );
  const visibleUnits = filteredUnits.slice(
    (unitPage - 1) * unitPageSize,
    unitPage * unitPageSize,
  );
  const filteredTenants = tenants.filter((tenant) => {
    const search = tenantSearch.toLowerCase();
    const name = (tenant.full_name || tenant.company_name || "").toLowerCase();
    return (
      (!search || `${name} ${tenant.phone || ""} ${tenant.email || ""}`.toLowerCase().includes(search)) &&
      (tenantTypeFilter === "All" || tenant.type === tenantTypeFilter)
    );
  });
  const tenantPageCount = Math.max(
    1,
    Math.ceil(filteredTenants.length / tenantPageSize),
  );
  const visibleTenants = filteredTenants.slice(
    (tenantPage - 1) * tenantPageSize,
    tenantPage * tenantPageSize,
  );
  const filteredUnitsRentTotal = filteredUnits.reduce(
    (total, unit) => total + unit.base_rent,
    0,
  );
  const filteredContracts = contracts.filter((contract) => {
    const tenant = tenants.find((item) => String(item.id) === String(contract.tenant_id));
    const unit = units.find((item) => String(item.id) === String(contract.unit_id));
    const search = contractSearch.toLowerCase();
    const searchable = `${tenant?.full_name || tenant?.company_name || ""} ${unit?.number || ""}`.toLowerCase();
    return (!search || searchable.includes(search)) && (contractStatusFilter === "All" || contract.status === contractStatusFilter);
  });
  const contractPageCount = Math.max(1, Math.ceil(filteredContracts.length / contractPageSize));
  const visibleContracts = filteredContracts.slice((contractPage - 1) * contractPageSize, contractPage * contractPageSize);

  const resetUnitList = () => {
    setUnitSearch("");
    setUnitTypeFilter("All");
    setUnitStatusFilter("All");
    setUnitFloorFilter("All");
    setUnitPage(1);
    setUnitPageSize(10);
  };

  const resetTenantList = () => {
    setTenantSearch("");
    setTenantTypeFilter("All");
    setTenantPage(1);
    setTenantPageSize(10);
  };

  const resetContractList = () => {
    setContractSearch("");
    setContractStatusFilter("All");
    setContractPage(1);
    setContractPageSize(10);
    setUpgradingContractID(null);
    setContractUpgradeForm(defaultContractUpgradeForm);
  };

  const showView = (nextView: View) => {
    setFormError("");
    if (nextView === "units") {
      resetUnitList();
      setRentUnitID(null);
      goTo("/units");
    }
    if (nextView === "tenants") {
      resetTenantList();
      setEditingTenantID(null);
      setTenantForm(defaultTenantForm);
      goTo("/tenants");
    }
    if (nextView === "contracts") {
      resetContractList();
      goTo("/contracts");
    }
    setView(nextView);
  };

  const today = new Date();
  const daysUntil = (date: string) =>
    Math.ceil(
      (new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000,
    );
  const scopedContracts = contracts.filter(
    (contract) =>
      selectedBuildingID === "hq" ||
      contract.building_id === Number(selectedBuildingID),
  );
  const activeContracts = scopedContracts.filter(
    (contract) => contract.status === "Active",
  );
  const expiring7 = activeContracts.filter(
    (contract) =>
      daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 7,
  );
  const expiring30 = activeContracts.filter(
    (contract) =>
      daysUntil(contract.end_date) >= 0 && daysUntil(contract.end_date) <= 30,
  );
  const expiredContracts = scopedContracts.filter(
    (contract) =>
      contract.end_date &&
      daysUntil(contract.end_date) < 0 &&
      contract.status !== "Cancelled",
  );
  const scopedInvoices = invoices.filter(
    (invoice) =>
      selectedBuildingID === "hq" ||
      invoice.building_id === Number(selectedBuildingID),
  );
  const unpaidInvoices = scopedInvoices.filter(
    (invoice) =>
      invoice.status === "Pending" ||
      invoice.status === "Partially Paid" ||
      invoice.status === "Overdue",
  );
  const scopedPayments = payments.filter(
    (payment) =>
      selectedBuildingID === "hq" ||
      payment.building_id === Number(selectedBuildingID),
  );
  const paymentsToday = scopedPayments.filter(
    (payment) => payment.payment_date === today.toISOString().slice(0, 10),
  );
  const totalContractRent = activeContracts.reduce(
    (total, contract) => total + contract.monthly_rent,
    0,
  );
  const totalInvoiced = scopedInvoices.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  const totalPaid = scopedPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
  const branchCards = buildings.map((building) => {
    const branchContracts = contracts.filter(
      (contract) => String(contract.building_id) === String(building.id),
    );
    const branchInvoices = invoices.filter(
      (invoice) => String(invoice.building_id) === String(building.id),
    );
    return {
      building,
      active: branchContracts.filter((contract) => contract.status === "Active")
        .length,
      expiring7: branchContracts.filter(
        (contract) =>
          contract.status === "Active" &&
          daysUntil(contract.end_date) >= 0 &&
          daysUntil(contract.end_date) <= 7,
      ).length,
      expiring30: branchContracts.filter(
        (contract) =>
          contract.status === "Active" &&
          daysUntil(contract.end_date) >= 0 &&
          daysUntil(contract.end_date) <= 30,
      ).length,
      expired: branchContracts.filter(
        (contract) =>
          contract.end_date &&
          daysUntil(contract.end_date) < 0 &&
          contract.status !== "Cancelled",
      ).length,
      unpaid: branchInvoices.filter(
        (invoice) =>
          invoice.status !== "Paid" && invoice.status !== "Cancelled",
      ).length,
    };
  });

  const switchBuilding = (buildingID: string) => {
    setSelectedBuildingID(buildingID);
    setView("home");
  };

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>
            Masco<span className="brand-muted">Rent</span>
          </span>
        </div>
        <p className="user-name">{session.user.full_name}</p>
        <nav className="nav">
          <button
            className={`nav-link ${view === "home" ? "active" : ""}`}
            onClick={() => showView("home")}
          >
            Home
          </button>
          {selectedBuildingID === "hq" ? (
            <>
              <button
                className={`nav-link ${view === "registration" ? "active" : ""}`}
                onClick={() => showView("registration")}
              >
                Registration
              </button>
              <button
                className={`nav-link ${view === "reports" ? "active" : ""}`}
                onClick={() => showView("reports")}
              >
                Reports
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-link ${view === "units" ? "active" : ""}`}
                onClick={() => showView("units")}
              >
                Units
              </button>
              <button
                className={`nav-link ${view === "tenants" ? "active" : ""}`}
                onClick={() => showView("tenants")}
              >
                Tenants
              </button>
              <button
                className={`nav-link ${view === "contracts" ? "active" : ""}`}
                onClick={() => showView("contracts")}
              >
                Contracts
              </button>
              <button
                className={`nav-link ${view === "invoices" ? "active" : ""}`}
                onClick={() => showView("invoices")}
              >
                Invoices
              </button>
              <button
                className={`nav-link ${view === "payments" ? "active" : ""}`}
                onClick={() => showView("payments")}
              >
                Payments
              </button>
            </>
          )}
          {selectedBuildingID === "hq" && (
            <button
              className={`nav-link ${view === "buildings" ? "active" : ""}`}
              onClick={() => showView("buildings")}
            >
              Buildings
            </button>
          )}
          <button
            className={`nav-link ${view === "settings" ? "active" : ""}`}
            onClick={() => showView("settings")}
          >
            Settings
          </button>
        </nav>
        <button
          className="logout-button"
          type="button"
          onClick={() => void handleLogout()}
        >
          Sign out
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {selectedBuilding ? selectedBuilding.code : "All buildings"}
            </p>
            <h1>{pageTitle[view]}</h1>
          </div>
          <label className="building-switcher">
            Portfolio context
            <select
              value={selectedBuildingID}
              onChange={(event) => switchBuilding(event.target.value)}
            >
              <option value="hq">HQ - all buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {view === "home" && !selectedBuilding && (
          <div className="hq-dashboard">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">HQ / Administration</p>
                <h2>ADMINISTRATION OWNER UPDATES - ALL BUILDINGS</h2>
              </div>
              <span className="updated-date">
                Updated: {today.toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="stats-grid dashboard-stats">
              <div className="stat-card">
                <span>Active contracts</span>
                <strong>{activeContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 7 days</span>
                <strong>{expiring7.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 30 days</span>
                <strong>{expiring30.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expired in progress</span>
                <strong>{expiredContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Unpaid active</span>
                <strong>{unpaidInvoices.length}</strong>
              </div>
              <div className="stat-card">
                <span>Payments today</span>
                <strong>{paymentsToday.length}</strong>
              </div>
            </div>
            <div className="amount-summary">
              <div>
                <span>Expected rent</span>
                <strong>{formatAmount(totalContractRent)}</strong>
              </div>
              <div>
                <span>Invoiced</span>
                <strong>{formatAmount(totalInvoiced)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatAmount(totalPaid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
              </div>
            </div>
            <div className="hq-section-heading">
              <div>
                <p className="eyebrow">Portfolio directory</p>
                <h2>Branches at a glance</h2>
              </div>
              <span>Choose a branch to enter its workspace</span>
            </div>
            <div className="branch-grid">
              {branchCards.map((branch) => (
                <button
                  className="branch-card"
                  key={branch.building.id}
                  onClick={() => switchBuilding(String(branch.building.id))}
                >
                  <span>BRANCH: {branch.building.code}</span>
                  <strong>{branch.active} active</strong>
                  <small>
                    {branch.expiring30} expiring in 30d · {branch.expired}{" "}
                    expired · {branch.unpaid} unpaid
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === "home" && selectedBuilding && (
          <div className="branch-dashboard">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">
                  Branch dashboard · {selectedBuilding.code}
                </p>
                <h2>OWNER UPDATES - {selectedBuilding.name}</h2>
              </div>
              <span className="updated-date">
                Updated: {today.toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="stats-grid dashboard-stats">
              <div className="stat-card">
                <span>Active contracts</span>
                <strong>{activeContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 7 days</span>
                <strong>{expiring7.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expiring 30 days</span>
                <strong>{expiring30.length}</strong>
              </div>
              <div className="stat-card">
                <span>Expired in progress</span>
                <strong>{expiredContracts.length}</strong>
              </div>
              <div className="stat-card">
                <span>Unpaid active</span>
                <strong>{unpaidInvoices.length}</strong>
              </div>
              <div className="stat-card">
                <span>Payments today</span>
                <strong>{paymentsToday.length}</strong>
              </div>
            </div>
            <div className="amount-summary">
              <div>
                <span>Expected rent</span>
                <strong>{formatAmount(totalContractRent)}</strong>
              </div>
              <div>
                <span>Invoiced</span>
                <strong>{formatAmount(totalInvoiced)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatAmount(totalPaid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{formatAmount(totalOutstanding)}</strong>
              </div>
            </div>
            <div className="dashboard-columns">
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Contracts to expire</h2>
                  <span>Next 30 days</span>
                </div>
                {expiring30.length === 0 ? (
                  <p className="empty-state">
                    No contracts expiring in next 30 days.
                  </p>
                ) : (
                  expiring30.map((contract) => (
                    <div className="dashboard-row" key={contract.id}>
                      <strong>{contract.tenant_id}</strong>
                      <span>{contract.unit_id}</span>
                      <span>{contract.end_date}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("contracts")}
                      >
                        View / Pay
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Expired contracts</h2>
                  <span>{expiredContracts.length} records</span>
                </div>
                {expiredContracts.length === 0 ? (
                  <p className="empty-state">No expired contracts.</p>
                ) : (
                  expiredContracts.map((contract) => (
                    <div className="dashboard-row" key={contract.id}>
                      <strong>{contract.tenant_id}</strong>
                      <span>{contract.unit_id}</span>
                      <span>{contract.end_date}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("contracts")}
                      >
                        View
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Unpaid active contracts</h2>
                  <span>Balance due</span>
                </div>
                {unpaidInvoices.length === 0 ? (
                  <p className="empty-state">No unpaid active contracts.</p>
                ) : (
                  unpaidInvoices.map((invoice) => (
                    <div className="dashboard-row" key={invoice.id}>
                      <strong>{invoice.number}</strong>
                      <span>{invoice.status}</span>
                      <span>{formatAmount(invoice.amount)}</span>
                      <button
                        className="row-action"
                        onClick={() => showView("payments")}
                      >
                        Pay
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="panel table-panel">
                <div className="section-heading">
                  <h2>Payments today</h2>
                  <span>Total: {paymentsToday.length}</span>
                </div>
                {paymentsToday.length === 0 ? (
                  <p className="empty-state">No payments today.</p>
                ) : (
                  paymentsToday.map((payment) => (
                    <div className="dashboard-row" key={payment.id}>
                      <strong>{payment.payment_reference}</strong>
                      <span>{payment.payment_method}</span>
                      <span>{formatAmount(payment.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "registration" && (
          <div className="registration-layout">
            <div className="registration-intro">
              <p className="eyebrow">Administration</p>
              <h2>System registration</h2>
              <p>
                Manage users, roles, and the shared catalogs used across every
                building.
              </p>
            </div>
            <div className="panel-grid">
              <form className="panel form-panel" onSubmit={handleCreateUser}>
                <h2>Register user</h2>
                <label>
                  Full name
                  <input
                    value={newUserForm.full_name}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        full_name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={newUserForm.username}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Temporary password
                  <input
                    type="password"
                    minLength={8}
                    value={newUserForm.password}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Register user
                </button>
              </form>
              <div className="panel list-panel">
                <h2>Users and access</h2>
                <div className="building-list">
                  {adminUsers.length === 0 ? (
                    <p className="empty-state">
                      No users loaded. Confirm roles and user_roles exist in the
                      database.
                    </p>
                  ) : (
                    adminUsers.map((user) => (
                      <article className="building-card" key={user.id}>
                        <div className="building-header">
                          <div>
                            <h3>{user.full_name}</h3>
                            <span className="code-tag">{user.username}</span>
                          </div>
                          <select
                            value={user.status}
                            onChange={(event) =>
                              void updateUserStatus(user.id, event.target.value)
                            }
                          >
                            <option>Active</option>
                            <option>Inactive</option>
                            <option>Suspended</option>
                          </select>
                        </div>
                        <p>{user.email}</p>
                        <div className="meta-row">
                          <span>
                            {user.roles.length
                              ? user.roles.join(", ")
                              : "No role assigned"}
                          </span>
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value)
                                void assignUserRole(
                                  user.id,
                                  event.target.value,
                                );
                            }}
                          >
                            <option value="">Assign role</option>
                            {roles.map((role) => (
                              <option key={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="catalog-grid">
              <div className="catalog-card">
                <span>Buildings</span>
                <strong>{buildings.length}</strong>
                <small>Register and manage properties</small>
              </div>
              <div className="catalog-card">
                <span>Payment methods</span>
                <strong>6</strong>
                <small>Cash, bank, mobile, card, cheque, other</small>
              </div>
              <div className="catalog-card">
                <span>Roles</span>
                <strong>{roles.length}</strong>
                <small>Administrator, Manager, Accountant, Staff</small>
              </div>
            </div>
          </div>
        )}

        {view === "reports" && (
          <div className="reports-layout">
            <div className="registration-intro">
              <p className="eyebrow">Office reports</p>
              <h2>All buildings combined</h2>
              <p>
                Portfolio-wide statements for administration and owner review.
              </p>
            </div>
            <div className="reports-grid">
              <div className="report-card">
                <span>Transaction statement</span>
                <strong>{payments.length}</strong>
                <small>Recorded payments across all buildings</small>
              </div>
              <div className="report-card">
                <span>Expenses statement</span>
                <strong>0</strong>
                <small>Expenses will appear here when registered</small>
              </div>
              <div className="report-card">
                <span>Monthly rent statement</span>
                <strong>{invoices.length}</strong>
                <small>Generated invoices across the portfolio</small>
              </div>
              <div className="report-card">
                <span>Tenant statement</span>
                <strong>{tenants.length}</strong>
                <small>Tenants with active portfolio records</small>
              </div>
            </div>
            <div className="panel table-panel">
              <div className="section-heading">
                <h2>Recent transactions</h2>
                <span>All buildings</span>
              </div>
              {payments.length === 0 ? (
                <p className="empty-state">No transactions recorded.</p>
              ) : (
                payments.slice(0, 12).map((payment) => (
                  <div className="dashboard-row" key={payment.id}>
                    <strong>{payment.payment_reference}</strong>
                    <span>{payment.payment_method}</span>
                    <span>{formatAmount(payment.amount)}</span>
                    <span>{payment.payment_date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "buildings" && (
          <div className="panel-grid">
            <form className="panel form-panel" onSubmit={handleSubmit}>
              <h2>Add building</h2>
              <label>
                Building name
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Mlimani Apartments"
                />
              </label>
              <label>
                Building code
                <input
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="MLM-01"
                />
              </label>
              <label>
                Address
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Dar es Salaam"
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Residential building"
                />
              </label>
              <div className="inline-fields">
                <label>
                  Floors
                  <input
                    type="number"
                    min="1"
                    name="floors"
                    value={form.floors}
                    onChange={handleChange}
                  />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option>Active</option>
                    <option>Maintenance</option>
                    <option>Closed</option>
                  </select>
                </label>
              </div>
              <button className="primary-button" type="submit">
                Save building
              </button>
              {formError && <p className="form-error">{formError}</p>}
            </form>

            <div className="panel list-panel">
              <h2>Registered buildings</h2>
              <div className="building-list">
                {buildings.length === 0 ? (
                  <p className="empty-state">No buildings yet.</p>
                ) : (
                  buildings.map((building) => (
                    <article className="building-card" key={building.id}>
                      <div className="building-header">
                        <div>
                          <h3>{building.name}</h3>
                          <span className="code-tag">{building.code}</span>
                        </div>
                        <span className="status-badge">{building.status}</span>
                      </div>
                      <p>{building.address}</p>
                      <div className="meta-row">
                        <span>{building.floors} floors</span>
                        <span>{building.description || "No description"}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "units" && (
          <div className={`panel-grid units-workspace ${unitPageMode}`}>
            {unitPageMode === "list" && (
              <button
                className="secondary-button units-add-button"
                type="button"
                onClick={() => goTo("/units/new")}
              >
                + Add unit(s)
              </button>
            )}
            {unitPageMode === "create" && (
              <form className="panel form-panel" onSubmit={handleUnitSubmit}>
                <div className="section-heading">
                  <h2>{editingUnitID ? "Edit unit" : "Add units"}</h2>
                  <div>
                    {!editingUnitID && <button className="secondary-button" type="button" onClick={addUnitRow}>+ Add row</button>}
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => { setEditingUnitID(null); goTo("/units"); }}
                    >
                      Back to list
                    </button>
                  </div>
                </div>
                <p className="empty-state">
                  {selectedBuilding
                    ? `Adding to ${selectedBuilding.name}`
                    : "Select a building above before adding a unit."}
                </p>
                <div className="unit-entry-list">
                  {unitRows.map((row, rowIndex) => (
                    <div className="unit-entry-row" key={rowIndex}>
                      <input
                        value={row.number}
                        onChange={(event) =>
                          updateUnitRow(rowIndex, "number", event.target.value)
                        }
                        placeholder="Unit no."
                        required
                      />
                      <select
                        value={row.floor_id}
                        onChange={(event) =>
                          updateUnitRow(
                            rowIndex,
                            "floor_id",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Floor</option>
                        {floors.map((floor) => (
                          <option key={floor.id} value={floor.id}>
                            {floor.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.type}
                        onChange={(event) =>
                          updateUnitRow(rowIndex, "type", event.target.value)
                        }
                      >
                        <option>Residential</option>
                        <option>Commercial</option>
                        <option>Service</option>
                      </select>
                      <input
                        inputMode="decimal"
                        value={row.base_rent}
                        onChange={(event) =>
                          updateUnitRow(
                            rowIndex,
                            "base_rent",
                            formatAmount(event.target.value),
                          )
                        }
                        placeholder="Required rent"
                        required
                      />
                      <button
                        className="remove-row"
                        type="button"
                        onClick={() => removeUnitRow(rowIndex)}
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="primary-button" type="submit">{editingUnitID ? "Save changes" : "Save unit"}</button>
              </form>
            )}
            {unitPageMode === "rent" && (
              <form className="panel form-panel rent-panel" onSubmit={handleContractSubmit}>
                <div className="section-heading">
                  <h2>Rent unit</h2>
                  <button className="secondary-button" type="button" onClick={() => { setRentUnitID(null); goTo("/units"); }}>Back to list</button>
                </div>
                <p className="empty-state">{selectedBuilding?.name} · Unit {units.find((unit) => unit.id === rentUnitID)?.number}</p>
                <label>Tenant<select name="tenant_id" value={contractForm.tenant_id} onChange={handleContractChange} required><option value="">Select tenant</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.company_name}</option>)}</select></label>
                <div className="inline-fields"><label>Start date<input type="date" name="start_date" value={contractForm.start_date} onChange={handleContractChange} required /></label><label>Period (months)<input type="number" min="1" name="period" value={contractForm.period} onChange={handleContractChange} required /></label></div>
                <div className="inline-fields"><label>End date<input type="date" value={calculatedEndDate} readOnly /></label><label>Required monthly rent<input inputMode="decimal" value={contractForm.monthly_rent} readOnly /></label></div>
                <div className="inline-fields"><label>Prepaid amount<input inputMode="decimal" name="prepaid_amount" value={contractForm.prepaid_amount} onChange={(event) => setContractForm((current) => ({ ...current, prepaid_amount: formatAmount(event.target.value) }))} /><small className="field-help">Amount paid now. Enter 0 when no payment is received.</small></label><label>Total amount<input value={formatAmount(totalRent)} readOnly /></label></div>
                <label>Balance<input value={formatAmount(balanceAmount)} readOnly /></label>
                <div className="inline-fields"><label>Payment method<select name="payment_method" value={contractForm.payment_method} onChange={handleContractChange}><option>Bank Transfer</option><option>Cash</option><option>Mobile Money</option><option>Cheque</option></select></label><label>Payment frequency<select name="payment_frequency" value={contractForm.payment_frequency} onChange={handleContractChange}><option>Monthly</option><option>Every 3 months</option><option>Every 6 months</option><option>Yearly</option></select></label></div>
                <label>Notes<textarea name="notes" value={contractForm.notes} onChange={handleContractChange} placeholder="Lease notes" /></label>
                <button className="primary-button" type="submit">Create contract</button>
              </form>
            )}
            <div className="panel list-panel">
              <div className="section-heading">
                <h2>
                  {selectedBuilding
                    ? `${selectedBuilding.name} units`
                    : "Units"}
                </h2>
                <span>{filteredUnits.length} entries</span>
              </div>
              {selectedBuildingID === "hq" ? (
                <p className="empty-state">
                  Choose a building to see its units.
                </p>
              ) : (
                <>
                  <div className="unit-toolbar">
                    <input
                      value={unitSearch}
                      onChange={(event) => {
                        setUnitSearch(event.target.value);
                        setUnitPage(1);
                      }}
                      placeholder="Search room number"
                    />
                    <select
                      value={unitFloorFilter}
                      onChange={(event) => {
                        setUnitFloorFilter(event.target.value);
                        setUnitPage(1);
                      }}
                    >
                      <option value="All">All floors</option>
                      {floors.map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={unitTypeFilter}
                      onChange={(event) => {
                        setUnitTypeFilter(event.target.value);
                        setUnitPage(1);
                      }}
                    >
                      <option>All</option>
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Service</option>
                    </select>
                    <select
                      value={unitStatusFilter}
                      onChange={(event) => {
                        setUnitStatusFilter(event.target.value);
                        setUnitPage(1);
                      }}
                    >
                      <option>All</option>
                      <option>Vacant</option>
                      <option>Occupied</option>
                      <option>Reserved</option>
                      <option>Maintenance</option>
                    </select>
                    <select
                      value={unitPageSize}
                      onChange={(event) => {
                        setUnitPageSize(Number(event.target.value));
                        setUnitPage(1);
                      }}
                    >
                      <option value="10">10 entries</option>
                      <option value="25">25 entries</option>
                      <option value="50">50 entries</option>
                    </select>
                  </div>
                  <div className="unit-table-wrap">
                    <table className="unit-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Room No.</th>
                          <th>Floor</th>
                          <th>Type</th>
                          <th>Required rent</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUnits.length === 0 ? (
                          <tr>
                            <td colSpan={7}>No units match these filters.</td>
                          </tr>
                        ) : (
                          visibleUnits.map((unit, index) => (
                            <tr key={unit.id}>
                              <td>
                                {(unitPage - 1) * unitPageSize + index + 1}
                              </td>
                              <td>{unit.number}</td>
                              <td>
                                {floors.find(
                                  (floor) =>
                                    String(floor.id) === String(unit.floor_id),
                                )?.name || "-"}
                              </td>
                              <td>
                                <span className="code-tag">{unit.type}</span>
                              </td>
                              <td>{formatAmount(unit.base_rent)}</td>
                              <td>
                                <span
                                  className={`table-status ${unit.status.toLowerCase()}`}
                                >
                                  {unit.status}
                                </span>
                              </td>
                              <td>
                                {unit.status === "Vacant" && <button className="table-action rent" type="button" onClick={() => rentUnit(unit)}>Rent</button>}
                                <button className="table-action edit" type="button" onClick={() => void editUnit(unit)}>Edit</button>
                                <button className="table-action delete" type="button" onClick={() => void deleteUnit(unit)}>Delete</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}>Total required rent</td>
                          <td>{formatAmount(filteredUnitsRentTotal)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="pagination">
                    <span>
                      Showing{" "}
                      {visibleUnits.length
                        ? (unitPage - 1) * unitPageSize + 1
                        : 0}{" "}
                      to{" "}
                      {Math.min(unitPage * unitPageSize, filteredUnits.length)}{" "}
                      of {filteredUnits.length}
                    </span>
                    <div>
                      <button
                        type="button"
                        disabled={unitPage === 1}
                        onClick={() => setUnitPage((page) => page - 1)}
                      >
                        Previous
                      </button>
                      <strong>{unitPage}</strong>
                      <button
                        type="button"
                        disabled={unitPage >= unitPageCount}
                        onClick={() => setUnitPage((page) => page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {view === "tenants" && (
          <div className={`panel-grid tenants-workspace ${tenantPageMode}`}>
            {tenantPageMode === "invoice" && (
              <form className="panel form-panel proforma-panel" onSubmit={handleProformaSubmit}>
                <div className="section-heading">
                  <h2>Prepare proforma invoice</h2>
                  <button className="secondary-button" type="button" onClick={() => goTo("/tenants")}>
                    Back to tenants
                  </button>
                </div>
                <p className="empty-state">
                  Tenant: {tenants.find((tenant) => String(tenant.id) === proformaTenantID)?.full_name || tenants.find((tenant) => String(tenant.id) === proformaTenantID)?.company_name || "New tenant"}
                </p>
                <label>
                  Room
                  <select name="unit_id" value={proformaForm.unit_id} onChange={handleProformaChange} required>
                    <option value="">Choose room</option>
                    {units.filter((unit) => unit.status === "Vacant").map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.number}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Monthly price
                  <input value={proformaForm.unit_id ? formatAmount(units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) : ""} readOnly />
                </label>
                <label>
                  Entry date
                  <input type="date" name="start_date" value={proformaForm.start_date} onChange={handleProformaChange} required />
                </label>
                <label>
                  Period (months)
                  <input type="number" min="1" name="period" value={proformaForm.period} onChange={handleProformaChange} required />
                </label>
                <label>
                  Ending date
                  <input value={(() => { const start = new Date(`${proformaForm.start_date}T00:00:00`); const period = Math.max(1, Number(proformaForm.period) || 1); return proformaForm.start_date ? new Date(start.getFullYear(), start.getMonth() + period, start.getDate()).toISOString().slice(0, 10) : ""; })()} readOnly />
                </label>
                <label>
                  Total amount
                  <input value={formatAmount((units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) * (Number(proformaForm.period) || 1))} readOnly />
                </label>
                <label>
                  Prepaid amount
                  <input inputMode="decimal" name="prepaid_amount" value={proformaForm.prepaid_amount} onChange={handleProformaChange} />
                  <small className="field-help">If customer pays now, put amount here. (0 = no payment)</small>
                </label>
                <label>
                  Balance
                  <input value={formatAmount(Math.max(0, (units.find((unit) => String(unit.id) === proformaForm.unit_id)?.base_rent ?? 0) * (Number(proformaForm.period) || 1) - amountNumber(proformaForm.prepaid_amount)))} readOnly />
                </label>
                <label>
                  Date
                  <input type="date" name="issue_date" value={proformaForm.issue_date} onChange={handleProformaChange} required />
                </label>
                <button className="primary-button" type="submit">Generate invoice</button>
              </form>
            )}
            {tenantPageMode === "list" && (
              <button
                className="secondary-button tenants-add-button"
                type="button"
                onClick={() => goTo("/tenants/new")}
              >
                + Add tenant
              </button>
            )}
            {(tenantPageMode === "create" || tenantPageMode === "edit") && (
              <form className="panel form-panel" onSubmit={handleTenantSubmit}>
                <div className="section-heading">
                  <h2>{tenantPageMode === "edit" ? "Edit tenant" : "Add tenant"}</h2>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setEditingTenantID(null);
                      setTenantForm(defaultTenantForm);
                      goTo("/tenants");
                    }}
                  >
                    Back to list
                  </button>
                </div>
              <label>
                Tenant type
                <select
                  name="type"
                  value={tenantForm.type}
                  onChange={handleTenantChange}
                >
                  <option value="Person">Person</option>
                  <option value="Institution">Institution</option>
                </select>
              </label>
              {tenantForm.type === "Person" ? (
                <>
                  <label>
                    Full name
                    <input
                      name="full_name"
                      value={tenantForm.full_name}
                      onChange={handleTenantChange}
                      placeholder="Jane Doe"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Company name
                    <input
                      name="company_name"
                      value={tenantForm.company_name}
                      onChange={handleTenantChange}
                      placeholder="Alpha Logistics"
                    />
                  </label>
                  <label>
                    Contact person
                    <input
                      name="contact_person"
                      value={tenantForm.contact_person}
                      onChange={handleTenantChange}
                      placeholder="John Smith"
                    />
                  </label>
                </>
              )}
              <label>
                Phone
                <input
                  name="phone"
                  value={tenantForm.phone}
                  onChange={handleTenantChange}
                  placeholder="+255 700 000 001"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  value={tenantForm.email}
                  onChange={handleTenantChange}
                  placeholder="tenant@example.com"
                />
              </label>
              <label>
                Address
                <textarea
                  name="address"
                  value={tenantForm.address}
                  onChange={handleTenantChange}
                  placeholder="Resident address"
                />
              </label>
              <label>
                ID / registration ref
                <input
                  name="id_number"
                  value={tenantForm.id_number}
                  onChange={handleTenantChange}
                  placeholder="NIN / Licence / Reg No"
                />
              </label>
              <button className="primary-button" type="submit">
                Save tenant
              </button>
              </form>
            )}

            <div className="panel list-panel">
              <div className="section-heading">
                <h2>Tenants</h2>
                <span>{filteredTenants.length} entries</span>
              </div>
              <div className="unit-toolbar tenant-toolbar">
                <input
                  value={tenantSearch}
                  onChange={(event) => {
                    setTenantSearch(event.target.value);
                    setTenantPage(1);
                  }}
                  placeholder="Search tenant"
                />
                <select
                  value={tenantTypeFilter}
                  onChange={(event) => {
                    setTenantTypeFilter(event.target.value);
                    setTenantPage(1);
                  }}
                >
                  <option value="All">All types</option>
                  <option>Person</option>
                  <option>Institution</option>
                </select>
                <select
                  value={tenantPageSize}
                  onChange={(event) => {
                    setTenantPageSize(Number(event.target.value));
                    setTenantPage(1);
                  }}
                >
                  <option value="10">10 entries</option>
                  <option value="25">25 entries</option>
                  <option value="50">50 entries</option>
                </select>
              </div>
              <div className="unit-table-wrap">
                <table className="unit-table tenant-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Rented units</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No tenants match these filters.</td>
                      </tr>
                    ) : (
                      visibleTenants.map((tenant, index) => (
                        <tr key={tenant.id}>
                          {(() => {
                            const rentedContracts = contracts
                              .filter((contract) => String(contract.tenant_id) === String(tenant.id))
                              .map((contract) => ({
                                contract,
                                unit: units.find((unit) => String(unit.id) === String(contract.unit_id)),
                              }))
                              .filter((item) => item.unit);
                            return (
                              <>
                          <td>{(tenantPage - 1) * tenantPageSize + index + 1}</td>
                          <td>{tenant.full_name || tenant.company_name || "Unnamed tenant"}</td>
                          <td><span className="code-tag">{tenant.type}</span></td>
                          <td>{tenant.phone || "-"}</td>
                          <td>{tenant.email || "-"}</td>
                          <td>
                            {rentedContracts.length ? rentedContracts.map(({ contract, unit }) => (
                              <button
                                className="contract-unit-link"
                                key={contract.id}
                                type="button"
                                title="Open contract"
                                onClick={() => void handleContractPreview(contract.id)}
                              >
                                {unit?.number}
                              </button>
                            )) : "None"}
                          </td>
                          <td>
                            <button className="table-action edit" type="button" onClick={() => editTenant(tenant)}>Edit</button>
                            <button className="table-action delete" type="button" onClick={() => void deleteTenant(tenant)} disabled={rentedContracts.length > 0}>Delete</button>
                          </td>
                              </>
                            );
                          })()}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  Showing {visibleTenants.length ? (tenantPage - 1) * tenantPageSize + 1 : 0} to {Math.min(tenantPage * tenantPageSize, filteredTenants.length)} of {filteredTenants.length}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={tenantPage === 1}
                    onClick={() => setTenantPage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  <strong>{tenantPage}</strong>
                  <button
                    type="button"
                    disabled={tenantPage >= tenantPageCount}
                    onClick={() => setTenantPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "contracts" && (
          <>
            <div className={`panel-grid contracts-workspace ${contractPageMode}`}>
              {contractPageMode === "list" && (
                <button className="secondary-button contracts-add-button" type="button" onClick={() => goTo("/contracts/new")}>
                  + Add contract
                </button>
              )}
              {contractPageMode === "upgrade" && (() => {
                const contract = contracts.find((item) => item.id === upgradingContractID);
                const unit = units.find((item) => String(item.id) === String(contract?.unit_id));
                const period = Math.max(1, Number(contractUpgradeForm.period) || 1);
                const endDate = contract?.end_date ? new Date(new Date(`${contract.end_date}T00:00:00`).getFullYear(), new Date(`${contract.end_date}T00:00:00`).getMonth() + period, new Date(`${contract.end_date}T00:00:00`).getDate()).toISOString().slice(0, 10) : "";
                return (
                  <form className="panel form-panel contract-upgrade-panel" onSubmit={handleContractUpgradeSubmit}>
                    <div className="section-heading"><h2>Upgrade tenant contract</h2><button className="secondary-button" type="button" onClick={() => goTo("/contracts")}>Back to list</button></div>
                    <p className="empty-state">{unit?.number || "Unit"} · Current ending date: {contract?.end_date || "-"}</p>
                    <label>Monthly price<input value={formatAmount(contract?.monthly_rent ?? 0)} readOnly /></label>
                    <label>Add period (months)<input type="number" min="1" name="period" value={contractUpgradeForm.period} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, period: event.target.value }))} required /></label>
                    <label>New ending date<input value={endDate} readOnly /></label>
                    <label>Total amount (added)<input value={formatAmount((contract?.monthly_rent ?? 0) * period)} readOnly /></label>
                    <label>Prepaid amount<input inputMode="decimal" name="prepaid_amount" value={contractUpgradeForm.prepaid_amount} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, prepaid_amount: formatAmount(event.target.value) }))} /></label>
                    <label>Balance<input value={formatAmount(Math.max(0, (contract?.monthly_rent ?? 0) * period - amountNumber(contractUpgradeForm.prepaid_amount)))} readOnly /></label>
                    <label>Date<input type="date" name="payment_date" value={contractUpgradeForm.payment_date} onChange={(event) => setContractUpgradeForm((current) => ({ ...current, payment_date: event.target.value }))} required /></label>
                    <button className="primary-button" type="submit">Save upgrade</button>
                  </form>
                );
              })()}
              {contractPageMode === "document" && (
                <form className="panel form-panel signed-contract-panel" onSubmit={handleDocumentSubmit}>
                  <div className="section-heading">
                    <h2>Attach signed contract</h2>
                    <button className="secondary-button" type="button" onClick={() => goTo("/contracts")}>Back to list</button>
                  </div>
                  <p className="empty-state">
                    Contract for {tenants.find((tenant) => String(tenant.id) === String(contracts.find((contract) => String(contract.id) === documentContractID)?.tenant_id))?.full_name || tenants.find((tenant) => String(tenant.id) === String(contracts.find((contract) => String(contract.id) === documentContractID)?.tenant_id))?.company_name || "tenant"}
                  </p>
                  <label>
                    Document name
                    <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Signed lease agreement" />
                  </label>
                  <label>
                    PDF or Word file
                    <input type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <button className="primary-button" type="submit">Upload signed contract</button>
                </form>
              )}
              <form
                className="panel form-panel"
                onSubmit={handleContractSubmit}
              >
                <div className="section-heading"><h2>Add contract</h2><button className="secondary-button" type="button" onClick={() => goTo("/contracts")}>Back to list</button></div>
                <label>
                  Tenant
                  <select
                    name="tenant_id"
                    value={contractForm.tenant_id}
                    onChange={handleContractChange}
                  >
                    <option value="">Select tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.full_name || tenant.company_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unit
                  <select
                    name="unit_id"
                    value={contractForm.unit_id}
                    onChange={handleContractChange}
                    disabled={selectedBuildingID === "hq"}
                  >
                    <option value="">
                      {selectedBuildingID === "hq"
                        ? "Choose a building context first"
                        : "Select unit"}
                    </option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.number} - {unit.type}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="inline-fields">
                  <label>
                    Contract type
                    <select
                      name="contract_type"
                      value={contractForm.contract_type}
                      onChange={handleContractChange}
                    >
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Service</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      name="status"
                      value={contractForm.status}
                      onChange={handleContractChange}
                    >
                      <option>Active</option>
                      <option>Draft</option>
                      <option>Expired</option>
                      <option>Cancelled</option>
                    </select>
                  </label>
                </div>
                <div className="inline-fields">
                  <label>
                    Start date
                    <input
                      type="date"
                      name="start_date"
                      value={contractForm.start_date}
                      onChange={handleContractChange}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      name="end_date"
                      value={contractForm.end_date}
                      onChange={handleContractChange}
                    />
                  </label>
                </div>
                <label>
                  Monthly rent
                  <input
                    inputMode="decimal"
                    name="monthly_rent"
                    value={contractForm.monthly_rent}
                    onChange={(event) =>
                      setContractForm((current) => ({
                        ...current,
                        monthly_rent: formatAmount(event.target.value),
                      }))
                    }
                  />
                </label>
                <div className="inline-fields">
                  <label>
                    Payment method
                    <select
                      name="payment_method"
                      value={contractForm.payment_method}
                      onChange={handleContractChange}
                    >
                      <option>Bank Transfer</option>
                      <option>Cash</option>
                      <option>Mobile Money</option>
                      <option>Cheque</option>
                    </select>
                  </label>
                  <label>
                    Payment frequency
                    <select
                      name="payment_frequency"
                      value={contractForm.payment_frequency}
                      onChange={handleContractChange}
                    >
                      <option>Monthly</option>
                      <option>Every 3 months</option>
                      <option>Every 6 months</option>
                      <option>Yearly</option>
                    </select>
                  </label>
                </div>
                <label>
                  Utilities responsibility
                  <input
                    name="utility_responsibility"
                    value={contractForm.utility_responsibility}
                    onChange={handleContractChange}
                  />
                </label>
                <label>
                  Lease terms
                  <textarea
                    name="terms"
                    value={contractForm.terms}
                    onChange={handleContractChange}
                    placeholder="Use, care, renewal, and termination terms"
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    name="notes"
                    value={contractForm.notes}
                    onChange={handleContractChange}
                    placeholder="Contract notes"
                  />
                </label>
                <button className="primary-button" type="submit">
                  Save contract
                </button>
              </form>

              <div className="panel list-panel">
                <div className="section-heading"><h2>Contracts</h2><span>{filteredContracts.length} entries</span></div>
                <div className="unit-toolbar contract-toolbar">
                  <input value={contractSearch} onChange={(event) => { setContractSearch(event.target.value); setContractPage(1); }} placeholder="Search tenant or room" />
                  <select value={contractStatusFilter} onChange={(event) => { setContractStatusFilter(event.target.value); setContractPage(1); }}><option>All</option><option>Active</option><option>Expired</option><option>Cancelled</option><option>Draft</option></select>
                  <select value={contractPageSize} onChange={(event) => { setContractPageSize(Number(event.target.value)); setContractPage(1); }}><option value="10">10 entries</option><option value="25">25 entries</option><option value="50">50 entries</option></select>
                </div>
                <div className="unit-table-wrap"><table className="unit-table contract-table"><thead><tr><th>No.</th><th>Customer</th><th>Room</th><th>Type</th><th>Start</th><th>End</th><th>Time left</th><th>Price</th><th>Invoice</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                  {visibleContracts.length === 0 ? <tr><td colSpan={13}>No contracts match these filters.</td></tr> : visibleContracts.map((contract, index) => {
                    const tenant = tenants.find((item) => String(item.id) === String(contract.tenant_id));
                    const unit = units.find((item) => String(item.id) === String(contract.unit_id));
                    const invoice = invoices.find((item) => String(item.contract_id) === String(contract.id));
                    const paid = invoice ? payments.filter((item) => String(item.invoice_id) === String(invoice.id)).reduce((total, item) => total + item.amount, 0) : 0;
                    const balance = Math.max(0, (invoice?.amount ?? 0) - paid);
                    const remainingDays = contract.end_date ? daysUntil(contract.end_date) : null;
                    const timeLeft = contract.status === "Cancelled" ? "Terminated" : remainingDays === null ? "Open" : remainingDays < 0 ? "Expired" : remainingDays === 0 ? "Ends today" : `${remainingDays} days`;
                    return <tr key={contract.id}><td>{(contractPage - 1) * contractPageSize + index + 1}</td><td>{tenant?.full_name || tenant?.company_name || "Unknown tenant"}</td><td>{unit?.number || "-"}</td><td><span className="code-tag">{contract.contract_type}</span></td><td>{contract.start_date}</td><td>{contract.end_date || "-"}</td><td><span className={`time-left ${remainingDays !== null && remainingDays < 0 ? "expired" : ""}`}>{timeLeft}</span></td><td>{formatAmount(contract.monthly_rent)}</td><td>{formatAmount(invoice?.amount ?? 0)}</td><td>{formatAmount(paid)}</td><td>{formatAmount(balance)}</td><td><span className={`table-status ${contract.status.toLowerCase()}`}>{contract.status}</span></td><td><details className="contract-actions"><summary>Actions</summary><div className="contract-actions-menu"><button type="button" onClick={() => void handleContractView(contract.id)}>View contract</button><button type="button" onClick={() => void handleContractPreview(contract.id)}>View generated</button><button type="button" onClick={() => attachSignedContract(contract.id)}>Attach signed</button>{contract.status === "Active" && <><button type="button" onClick={() => payContractInvoice(contract.id)}>Pay</button><button type="button" onClick={() => upgradeContract(contract)}>Upgrade</button><button className="danger" type="button" onClick={() => void terminateContract(contract)}>Terminate</button></>}</div></details></td></tr>;
                  })}
                </tbody></table></div>
                <div className="pagination"><span>Showing {visibleContracts.length ? (contractPage - 1) * contractPageSize + 1 : 0} to {Math.min(contractPage * contractPageSize, filteredContracts.length)} of {filteredContracts.length}</span><div><button type="button" disabled={contractPage === 1} onClick={() => setContractPage((page) => page - 1)}>Previous</button><strong>{contractPage}</strong><button type="button" disabled={contractPage >= contractPageCount} onClick={() => setContractPage((page) => page + 1)}>Next</button></div></div>
              </div>
            </div>

          </>
        )}

        {view === "invoices" && (
          <div className="panel-grid">
            <div className="panel list-panel">
              <h2>Generate from contract</h2>
              <div className="building-list">
                {contracts.filter((contract) => contract.status === "Active")
                  .length === 0 ? (
                  <p className="empty-state">
                    Create an active contract before generating an invoice.
                  </p>
                ) : (
                  contracts
                    .filter((contract) => contract.status === "Active")
                    .map((contract) => (
                      <article className="building-card" key={contract.id}>
                        <h3>{contract.contract_type} contract</h3>
                        <p>
                          {formatAmount(contract.monthly_rent)} /{" "}
                          {contract.payment_frequency || "Monthly"}
                        </p>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() =>
                            void handleGenerateInvoice(contract.id)
                          }
                        >
                          Generate invoice
                        </button>
                      </article>
                    ))
                )}
              </div>
            </div>
            <div className="panel list-panel">
              <h2>Invoices</h2>
              <div className="building-list">
                {invoices.length === 0 ? (
                  <p className="empty-state">No invoices yet.</p>
                ) : (
                  invoices.map((invoice) => (
                    <article className="building-card" key={invoice.id}>
                      <div className="building-header">
                        <div>
                          <h3>{invoice.number}</h3>
                          <span className="code-tag">{invoice.status}</span>
                        </div>
                      </div>
                      <p>Invoice record: {invoice.id}</p>
                      <div className="meta-row">
                        <span>Amount: {formatAmount(invoice.amount)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "payments" && (
          <div className="panel-grid">
            <form className="panel form-panel" onSubmit={handlePaymentSubmit}>
              <h2>Record payment</h2>
              <label>
                Invoice
                <select
                  name="invoice_id"
                  value={paymentForm.invoice_id}
                  onChange={handlePaymentChange}
                  required
                >
                  <option value="">Select invoice</option>
                  {invoices
                    .filter(
                      (invoice) =>
                        invoice.status !== "Paid" &&
                        invoice.status !== "Cancelled",
                    )
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.number} - {formatAmount(invoice.amount)} (
                        {invoice.status})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Amount received
                <input
                  name="amount"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: formatAmount(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <div className="inline-fields">
                <label>
                  Payment date
                  <input
                    name="payment_date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={handlePaymentChange}
                    required
                  />
                </label>
                <label>
                  Method
                  <select
                    name="payment_method"
                    value={paymentForm.payment_method}
                    onChange={handlePaymentChange}
                  >
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Mobile Money</option>
                    <option>Card</option>
                    <option>Cheque</option>
                  </select>
                </label>
              </div>
              <label>
                Payment reference
                <input
                  name="payment_reference"
                  value={paymentForm.payment_reference}
                  onChange={handlePaymentChange}
                  placeholder="Bank or receipt reference"
                  required
                />
              </label>
              <label>
                Receipt number
                <input
                  name="receipt_number"
                  value={paymentForm.receipt_number}
                  onChange={handlePaymentChange}
                  placeholder="Optional receipt number"
                />
              </label>
              <label>
                Notes
                <textarea
                  name="notes"
                  value={paymentForm.notes}
                  onChange={handlePaymentChange}
                  placeholder="Optional payment notes"
                />
              </label>
              <button className="primary-button" type="submit">
                Record payment
              </button>
            </form>
            <div className="panel list-panel">
              <h2>Payment history</h2>
              <div className="building-list">
                {payments.length === 0 ? (
                  <p className="empty-state">No payments recorded.</p>
                ) : (
                  payments.map((payment) => (
                    <article className="building-card" key={payment.id}>
                      <div className="building-header">
                        <div>
                          <h3>{formatAmount(payment.amount)}</h3>
                          <span className="code-tag">
                            {payment.payment_method}
                          </span>
                        </div>
                        <span className="status-badge">
                          {payment.payment_date}
                        </span>
                      </div>
                      <p>{payment.payment_reference}</p>
                      <div className="meta-row">
                        <span>Invoice #{payment.invoice_id}</span>
                        <span>
                          {payment.receipt_number || "No receipt number"}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {view === "settings" && (
          <div className="panel-grid">
            <form className="panel form-panel" onSubmit={handleProfileSubmit}>
              <h2>Profile</h2>
              <label>
                Full name
                <input
                  name="full_name"
                  value={profileForm.full_name}
                  onChange={handleProfileChange}
                  required
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Save profile
              </button>
            </form>
            <form className="panel form-panel" onSubmit={handlePasswordSubmit}>
              <h2>Change password</h2>
              <label>
                Current password
                <input
                  name="current_password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  name="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label>
                Confirm new password
                <input
                  name="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Change password
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
