// Tipos de negocio de Deportia. Mismos datos que backend/rubros.py (fuente: specs/rubros.json).
export interface Rubro {
  key: string;
  label: string;
  icon: string;
  tagline: string;
  modules: string[];
}

export const RUBROS: Rubro[] = [
  {
    "key": "PADEL",
    "label": "Complejo de pádel",
    "icon": "🎾",
    "tagline": "Turnos, reservas web y torneos",
    "modules": [
      "turnos",
      "canchas",
      "clientes",
      "buffet",
      "web_reservas",
      "torneos",
      "facturacion",
      "reportes"
    ]
  },
  {
    "key": "FUTBOL",
    "label": "Fútbol 5, 7 y 11",
    "icon": "⚽",
    "tagline": "Canchas, buffet y ligas",
    "modules": [
      "turnos",
      "canchas",
      "clientes",
      "buffet",
      "web_reservas",
      "torneos",
      "facturacion",
      "reportes"
    ]
  },
  {
    "key": "TENIS",
    "label": "Club de tenis",
    "icon": "🏸",
    "tagline": "Canchas, reservas y torneos",
    "modules": [
      "turnos",
      "canchas",
      "clientes",
      "web_reservas",
      "torneos"
    ]
  },
  {
    "key": "BASQUET_VOLEY",
    "label": "Básquet, vóley y hockey",
    "icon": "🏀",
    "tagline": "Alquiler de canchas y ligas",
    "modules": [
      "turnos",
      "canchas",
      "clientes",
      "buffet",
      "web_reservas",
      "torneos"
    ]
  },
  {
    "key": "CLUB_SOCIAL",
    "label": "Club social y deportivo",
    "icon": "🏟️",
    "tagline": "Canchas, buffet y torneos del club",
    "modules": [
      "turnos",
      "canchas",
      "clientes",
      "buffet",
      "torneos",
      "facturacion",
      "reportes"
    ]
  },
  {
    "key": "MULTI",
    "label": "Complejo multideporte",
    "icon": "🏆",
    "tagline": "Todo junto",
    "modules": [
      "turnos",
      "canchas",
      "facturacion",
      "clientes",
      "buffet",
      "torneos",
      "reportes",
      "web_reservas"
    ]
  }
];

export const rubroLabel = (key?: string | null) => RUBROS.find((r) => r.key === key)?.label ?? "";

/** Deportes que se tildan al elegir el tipo en el alta (se pueden cambiar a mano). */
export const RUBRO_SPORTS: Record<string, string[]> = {
  "PADEL": [
    "padel"
  ],
  "FUTBOL": [
    "futbol"
  ],
  "TENIS": [
    "tenis"
  ],
  "BASQUET_VOLEY": [
    "basquet",
    "hockey",
    "voley"
  ],
  "CLUB_SOCIAL": [
    "futbol",
    "padel",
    "tenis"
  ],
  "MULTI": [
    "basquet",
    "futbol",
    "padel",
    "tenis"
  ]
};

/** Resumen de lo que carga «Cargar sugerencias» (el detalle y la lógica están en el backend). */
export const RUBRO_STARTER: Record<string, { courts: string[]; deposit_percent: number }> = {
  "PADEL": {
    "courts": [
      "Cancha de pádel 1",
      "Cancha de pádel 2",
      "Cancha de pádel 3"
    ],
    "deposit_percent": 30
  },
  "FUTBOL": {
    "courts": [
      "Fútbol 5 - Cancha 1",
      "Fútbol 7 - Cancha 2",
      "Fútbol 11 - Cancha 3"
    ],
    "deposit_percent": 30
  },
  "TENIS": {
    "courts": [
      "Cancha de tenis 1",
      "Cancha de tenis 2"
    ],
    "deposit_percent": 20
  },
  "BASQUET_VOLEY": {
    "courts": [
      "Cancha de básquet",
      "Cancha de vóley",
      "Cancha de hockey"
    ],
    "deposit_percent": 20
  },
  "CLUB_SOCIAL": {
    "courts": [
      "Fútbol 5 - Cancha 1",
      "Cancha de pádel 1",
      "Cancha de tenis 1"
    ],
    "deposit_percent": 20
  },
  "MULTI": {
    "courts": [
      "Fútbol 5 - Cancha 1",
      "Cancha de pádel 1",
      "Cancha de tenis 1",
      "Cancha de básquet"
    ],
    "deposit_percent": 30
  }
};
