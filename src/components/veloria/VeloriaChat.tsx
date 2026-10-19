import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import "./VeloriaChat.css";

const API_URL = "http://127.0.0.1:8020";

interface VeloriaAction {
  type: string;
  label: string;
  route?: string;
}

interface VeloriaMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  actions?: VeloriaAction[];
}

interface ChatResponse {
  response: string;
  actions?: VeloriaAction[];
}

function VeloriaChat() {
  const [open, setOpen] = useState(false);

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<
    VeloriaMessage[]
  >([
    {
      id: 1,
      role: "assistant",
      content:
        "Hola. Soy VelorIA, tu asistente de Velora. Puedo ayudarte a consultar información y realizar operaciones dentro del sistema.",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  /*
   * ==========================================================
   * RESTAURAR CHAT
   * ==========================================================
   */

  useEffect(() => {
    try {
      const saved =
        sessionStorage.getItem(
          "veloria_messages"
        );

      if (!saved) {
        return;
      }

      const parsed =
        JSON.parse(saved);

      if (
        Array.isArray(parsed) &&
        parsed.length > 0
      ) {
        setMessages(parsed);
      }
    } catch (error) {
      console.error(
        "No se pudo restaurar VelorIA:",
        error
      );
    }
  }, []);

  /*
   * ==========================================================
   * GUARDAR CHAT
   * ==========================================================
   */

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "veloria_messages",
        JSON.stringify(messages)
      );
    } catch (error) {
      console.error(
        "No se pudo guardar VelorIA:",
        error
      );
    }
  }, [messages]);

  /*
   * ==========================================================
   * SCROLL AUTOMÁTICO
   * ==========================================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  /*
   * ==========================================================
   * FOCUS
   * ==========================================================
   */

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 180);
    }
  }, [open]);

  /*
   * ==========================================================
   * ENVIAR MENSAJE
   * ==========================================================
   */

  async function sendMessage(
    event?: FormEvent
  ) {
    event?.preventDefault();

    const cleanMessage =
      message.trim();

    if (
      !cleanMessage ||
      loading
    ) {
      return;
    }

    const token =
      localStorage.getItem(
        "velora_token"
      );

    if (!token) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now(),
          role: "assistant",
          content:
            "Tu sesión no es válida. Volvé a iniciar sesión en Velora.",
        },
      ]);

      return;
    }

    const userMessage: VeloriaMessage = {
      id: Date.now(),
      role: "user",
      content: cleanMessage,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response =
        await fetch(
          `${API_URL}/veloria/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              message:
                cleanMessage,
            }),
          }
        );

      const data: ChatResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data === "object" &&
          data &&
          "response" in data
            ? data.response
            : "VelorIA no pudo procesar el mensaje."
        );
      }

      setMessages((current) => [
        ...current,
        {
          id:
            Date.now() + 1,

          role:
            "assistant",

          content:
            data.response ||
            "No recibí una respuesta.",

          actions:
            data.actions ||
            [],
        },
      ]);
    } catch (error) {
      console.error(
        "Error comunicando con VelorIA:",
        error
      );

      setMessages((current) => [
        ...current,
        {
          id:
            Date.now() + 1,

          role:
            "assistant",

          content:
            error instanceof Error
              ? error.message
              : "No pude comunicarme con VelorIA.",
        },
      ]);
    } finally {
      setLoading(false);

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }

  /*
   * ==========================================================
   * ENTER / SHIFT + ENTER
   * ==========================================================
   */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }

  /*
   * ==========================================================
   * NAVEGACIÓN
   * ==========================================================
   */

  function executeAction(
    action: VeloriaAction
  ) {
    if (!action.route) {
      return;
    }

    /*
     * Usamos location.pathname para que
     * funcione incluso si el proyecto no
     * utiliza React Router.
     */

    window.location.href =
      action.route;
  }

  /*
   * ==========================================================
   * NUEVA CONVERSACIÓN
   * ==========================================================
   */

  function clearConversation() {
    const confirmed =
      window.confirm(
        "¿Querés comenzar una nueva conversación con VelorIA?"
      );

    if (!confirmed) {
      return;
    }

    const initialMessage: VeloriaMessage = {
      id: Date.now(),
      role: "assistant",
      content:
        "Conversación nueva. ¿En qué puedo ayudarte?",
    };

    setMessages([
      initialMessage,
    ]);

    sessionStorage.setItem(
      "veloria_messages",
      JSON.stringify([
        initialMessage,
      ])
    );
  }

  return (
    <>
      {/* =====================================================
          BOTÓN TOPBAR
      ===================================================== */}

      <button
        type="button"
        className={
          `veloria-trigger ${
            open
              ? "veloria-trigger-open"
              : ""
          }`
        }
        onClick={() =>
          setOpen((current) =>
            !current
          )
        }
        aria-label="Abrir VelorIA"
        title="VelorIA"
      >
        <span className="veloria-trigger-icon">
          ✦
        </span>

        <span className="veloria-trigger-text">
          VelorIA
        </span>

        <span
          className={
            `veloria-status-dot ${
              loading
                ? "veloria-status-thinking"
                : ""
            }`
          }
        />
      </button>

      {/* =====================================================
          CHAT
      ===================================================== */}

      <div
        className={
          `veloria-panel ${
            open
              ? "veloria-panel-open"
              : ""
          }`
        }
      >
        {/* HEADER */}

        <div className="veloria-header">
          <div className="veloria-header-left">
            <div className="veloria-avatar">
              ✦
            </div>

            <div className="veloria-header-info">
              <strong>
                VelorIA
              </strong>

              <span>
                Asistente inteligente
              </span>
            </div>
          </div>

          <div className="veloria-header-actions">
            <button
              type="button"
              className="veloria-header-button"
              onClick={
                clearConversation
              }
              title="Nueva conversación"
            >
              ↻
            </button>

            <button
              type="button"
              className="veloria-header-button"
              onClick={() =>
                setOpen(false)
              }
              title="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        {/* ESTADO */}

        <div className="veloria-subheader">
          <span className="veloria-live-dot" />

          <span>
            Conectada a Velora by Mezztt
          </span>
        </div>

        {/* MENSAJES */}

        <div className="veloria-messages">
          {messages.map(
            (item) => (
              <div
                key={item.id}
                className={
                  `veloria-message-row ${
                    item.role === "user"
                      ? "veloria-message-user"
                      : "veloria-message-assistant"
                  }`
                }
              >
                {item.role ===
                  "assistant" && (
                  <div className="veloria-small-avatar">
                    ✦
                  </div>
                )}

                <div className="veloria-message-content">
                  <div className="veloria-bubble">
<div className="veloria-message-content">
  <ReactMarkdown>
    {item.content}
  </ReactMarkdown>
</div>

                  </div>

                  {item.actions &&
                    item.actions.length >
                      0 && (
                      <div className="veloria-actions">
                        {item.actions.map(
                          (
                            action,
                            index
                          ) => (
                            <button
                              key={
                                `${action.label}-${index}`
                              }
                              type="button"
                              className="veloria-action-button"
                              onClick={() =>
                                executeAction(
                                  action
                                )
                              }
                            >
                              {action.label}

                              <span>
                                →
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                </div>
              </div>
            )
          )}

          {loading && (
            <div className="veloria-message-row veloria-message-assistant">
              <div className="veloria-small-avatar">
                ✦
              </div>

              <div className="veloria-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div
            ref={messagesEndRef}
          />
        </div>

        {/* INPUT */}

        <form
          className="veloria-input-area"
          onSubmit={
            sendMessage
          }
        >
          <div className="veloria-input-wrapper">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder="Preguntale algo a VelorIA..."
              rows={1}
              disabled={loading}
            />

            <button
              type="submit"
              className="veloria-send-button"
              disabled={
                loading ||
                !message.trim()
              }
              aria-label="Enviar mensaje"
            >
              ↑
            </button>
          </div>

          <div className="veloria-input-hint">
            Enter para enviar · Shift + Enter para una nueva línea
          </div>
        </form>
      </div>
    </>
  );
}

export default VeloriaChat;



