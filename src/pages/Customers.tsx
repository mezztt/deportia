import { useEffect, useState } from "react";

type Customer = {
  id: number;
  company_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tax_id: string | null;
  notes: string | null;
  active: boolean;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tax_id: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  tax_id: "",
  notes: "",
};

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] =
    useState<CustomerForm>(emptyForm);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  // ============================================================
  // CARGAR CLIENTES
  // ============================================================

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("velora_token");

      const response = await fetch(
        "http://127.0.0.1:8020/customers",
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "No se pudieron cargar los clientes."
        );
      }

      setCustomers(data);

    } catch (err) {
      console.error(
        "Error cargando clientes:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los clientes."
      );

    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // CARGAR AL ENTRAR
  // ============================================================

  useEffect(() => {
    loadCustomers();
  }, []);

  // ============================================================
  // ABRIR CREACIÓN
  // ============================================================

  function openCreateForm() {
    setEditingCustomer(null);

    setForm({
      ...emptyForm,
    });

    setError("");

    setModalOpen(true);
  }

  // ============================================================
  // ABRIR EDICIÓN
  // ============================================================

  function openEditForm(
    customer: Customer
  ) {
    setEditingCustomer(customer);

    setForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      tax_id: customer.tax_id || "",
      notes: customer.notes || "",
    });

    setError("");

    setModalOpen(true);
  }

  // ============================================================
  // CERRAR MODAL
  // ============================================================

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);

    setEditingCustomer(null);

    setForm({
      ...emptyForm,
    });

    setError("");
  }

  // ============================================================
  // CAMBIAR CAMPO
  // ============================================================

  function updateField(
    field: keyof CustomerForm,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  // ============================================================
  // GUARDAR CLIENTE
  // ============================================================

  async function saveCustomer(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError(
        "El nombre del cliente es obligatorio."
      );

      return;
    }

    try {
      setSaving(true);

      setError("");

      const token =
        localStorage.getItem("velora_token");

      const isEditing =
        editingCustomer !== null;

      const url = isEditing
        ? `http://127.0.0.1:8020/customers/${editingCustomer.id}`
        : "http://127.0.0.1:8020/customers";

      const response = await fetch(
        url,
        {
          method: isEditing
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            name: form.name.trim(),
            email:
              form.email.trim() || null,
            phone:
              form.phone.trim() || null,
            address:
              form.address.trim() || null,
            city:
              form.city.trim() || null,
            tax_id:
              form.tax_id.trim() || null,
            notes:
              form.notes.trim() || null,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "No se pudo guardar el cliente."
        );
      }

      closeModal();

      await loadCustomers();

    } catch (err) {
      console.error(
        "Error guardando cliente:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el cliente."
      );

    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // ELIMINAR CLIENTE
  // ============================================================

  async function deleteCustomer(
    customer: Customer
  ) {
    const confirmed =
      window.confirm(
        `¿Eliminar a ${customer.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const token =
        localStorage.getItem("velora_token");

      const response = await fetch(
        `http://127.0.0.1:8020/customers/${customer.id}`,
        {
          method: "DELETE",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "No se pudo eliminar el cliente."
        );
      }

      await loadCustomers();

    } catch (err) {
      console.error(
        "Error eliminando cliente:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el cliente."
      );
    }
  }

  // ============================================================
  // FILTRO
  // ============================================================

  const filteredCustomers =
    customers.filter(customer => {
      const searchText =
        search
          .toLowerCase()
          .trim();

      if (!searchText) {
        return true;
      }

      return (
        customer.name
          .toLowerCase()
          .includes(searchText) ||

        customer.email
          ?.toLowerCase()
          .includes(searchText) ||

        customer.phone
          ?.toLowerCase()
          .includes(searchText) ||

        customer.tax_id
          ?.toLowerCase()
          .includes(searchText) ||

        customer.city
          ?.toLowerCase()
          .includes(searchText)
      );
    });

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <section className="customers-page">

      <div className="customers-header">

        <div>

          <span className="dashboard-eyebrow">
            RELACIONES
          </span>

          <h1>
            Clientes
          </h1>

          <p>
            Administrá los clientes de tu
            distribuidora.
          </p>

        </div>

        <button
          className="primary-button"
          type="button"
          onClick={openCreateForm}
        >
          + Nuevo cliente
        </button>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && !modalOpen && (
        <div className="customers-error">
          {error}
        </div>
      )}


      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <div className="customers-toolbar">

        <div className="customers-search">

          <span>
            ⌕
          </span>

          <input
            type="text"
            value={search}
            onChange={event =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Buscar cliente, teléfono, CUIT..."
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
            >
              ×
            </button>
          )}

        </div>

        <div className="customers-count">

          {filteredCustomers.length}{" "}

          {filteredCustomers.length === 1
            ? "cliente"
            : "clientes"}

        </div>

      </div>


      {/* ======================================================
          TABLA
      ====================================================== */}

      <div className="customers-table-container">

        {loading ? (

          <div className="customers-loading">

            <div className="customers-loading-spinner" />

            <span>
              Cargando clientes...
            </span>

          </div>

        ) : filteredCustomers.length === 0 ? (

          <div className="customers-empty">

            <div className="customers-empty-icon">
              ◯
            </div>

            <h3>
              {customers.length === 0
                ? "No hay clientes"
                : "No encontramos clientes"}
            </h3>

            <p>
              {customers.length === 0
                ? "Cuando agregues clientes aparecerán aquí."
                : "Probá con otro nombre, teléfono o CUIT."}
            </p>

            {customers.length === 0 && (
              <button
                className="secondary-button"
                type="button"
                onClick={openCreateForm}
              >
                Crear primer cliente
              </button>
            )}

          </div>

        ) : (

          <div className="customers-table-wrapper">

            <table className="customers-table">

              <thead>

                <tr>

                  <th>
                    Cliente
                  </th>

                  <th>
                    Contacto
                  </th>

                  <th>
                    Ubicación
                  </th>

                  <th>
                    Identificación
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Acciones
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredCustomers.map(
                  customer => (

                    <tr
                      key={customer.id}
                    >

                      <td>

                        <div className="customer-name">
                          {customer.name}
                        </div>

                        {customer.notes && (
                          <div className="customer-notes">
                            {customer.notes}
                          </div>
                        )}

                      </td>


                      <td>

                        <div className="customer-contact">

                          {customer.phone && (
                            <span>
                              {customer.phone}
                            </span>
                          )}

                          {customer.email && (
                            <span>
                              {customer.email}
                            </span>
                          )}

                          {!customer.phone &&
                            !customer.email && (
                              <span>
                                —
                              </span>
                            )}

                        </div>

                      </td>


                      <td>

                        {customer.city ||
                          customer.address ||
                          "—"}

                      </td>


                      <td>

                        {customer.tax_id ||
                          "—"}

                      </td>


                      <td>

                        <span className="status-active">

                          <span className="status-dot" />

                          Activo

                        </span>

                      </td>


                      <td>

                        <div className="customer-actions">

                          <button
                            type="button"
                            className="customer-action-edit"
                            onClick={() =>
                              openEditForm(
                                customer
                              )
                            }
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="customer-action-delete"
                            onClick={() =>
                              deleteCustomer(
                                customer
                              )
                            }
                          >
                            Eliminar
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* ======================================================
          MODAL
      ====================================================== */}

      {modalOpen && (

        <div
          className="modal-overlay"
          onClick={closeModal}
        >

          <div
            className="customer-modal"
            onClick={event =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="dashboard-eyebrow">
                  CLIENTES
                </span>

                <h2>
                  {editingCustomer
                    ? "Editar cliente"
                    : "Nuevo cliente"}
                </h2>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>


            {error && (
              <div className="customers-modal-error">
                {error}
              </div>
            )}


            <form
              className="customer-form"
              onSubmit={saveCustomer}
            >

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Nombre *
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={event =>
                      updateField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Nombre o razón social"
                    autoFocus
                  />

                </div>


                <div className="form-group">

                  <label>
                    CUIT / Identificación
                  </label>

                  <input
                    type="text"
                    value={form.tax_id}
                    onChange={event =>
                      updateField(
                        "tax_id",
                        event.target.value
                      )
                    }
                    placeholder="Ej. 20-12345678-9"
                  />

                </div>

              </div>


              <div className="form-row">

                <div className="form-group">

                  <label>
                    Teléfono
                  </label>

                  <input
                    type="text"
                    value={form.phone}
                    onChange={event =>
                      updateField(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="+54 9..."
                  />

                </div>


                <div className="form-group">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={event =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="cliente@email.com"
                  />

                </div>

              </div>


              <div className="form-row">

                <div className="form-group">

                  <label>
                    Dirección
                  </label>

                  <input
                    type="text"
                    value={form.address}
                    onChange={event =>
                      updateField(
                        "address",
                        event.target.value
                      )
                    }
                    placeholder="Dirección"
                  />

                </div>


                <div className="form-group">

                  <label>
                    Ciudad
                  </label>

                  <input
                    type="text"
                    value={form.city}
                    onChange={event =>
                      updateField(
                        "city",
                        event.target.value
                      )
                    }
                    placeholder="Ciudad"
                  />

                </div>

              </div>


              <div className="form-group">

                <label>
                  Notas
                </label>

                <textarea
                  value={form.notes}
                  onChange={event =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Información adicional del cliente..."
                  rows={3}
                />

              </div>


              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Guardando..."
                    : editingCustomer
                      ? "Guardar cambios"
                      : "Crear cliente"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </section>
  );
}

export default Customers;



