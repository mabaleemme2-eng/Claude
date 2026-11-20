import { useSyncExternalStore } from 'react';

/**
 * Internationalisation. English is the base language and the source of truth for keys;
 * every other language must provide all keys (checked by the TypeScript compiler).
 * To add a language: add it to LANGS, LOCALES and create a dictionary below.
 */
export const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['it', 'Italiano'], ['fr', 'Français'], ['pt', 'Português'],
] as const;
export type Lang = (typeof LANGS)[number][0];
const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES', it: 'it-IT', fr: 'fr-FR', pt: 'pt-PT' };

const en = {
  // top bar
  balance: 'Balance', equity: 'Equity', margin: 'Margin', freeMargin: 'Free margin', level: 'Level', pnl: 'P&L',
  accountGroup: 'Account group (spread/swap)', connected: 'Connected', disconnected: 'Disconnected',
  pricingAdmin: '⚙ Pricing admin', language: 'Language',
  navMarkets: 'Markets', navChart: 'Chart', navOrder: 'Order', navPositions: 'Positions',
  // watchlist
  'cls.forex': 'Forex', 'cls.crypto': 'Crypto', 'cls.index': 'Indices', 'cls.commodity': 'Commodities', 'cls.stock': 'Stocks',
  'src.binance': 'Live · Binance', 'src.hyperliquid': 'Live · Hyperliquid', 'src.kraken': 'Live · Kraken',
  'src.cross': 'Live · cross rate calculated from live pairs', 'src.sim': 'SIMULATED · no free live source',
  'src.demo': 'DEMO · real price snapshot continued by simulation', ok: 'OK',
  demoBanner: 'Demo mode: prices are a real market snapshot taken {date}, continued by simulation. Live prices are available when you run the platform on your computer or a server.',
  searchInstr: 'Search {n} instruments…', all: 'All', symbol: 'Symbol', bid: 'Bid', ask: 'Ask', noResults: 'No instruments found.',
  // order panel
  buyExecuted: 'Buy executed', sellExecuted: 'Sell executed', pendingPlaced: 'Pending order placed',
  market: 'Market', limit: 'Limit', stop: 'Stop', sell: 'SELL', buy: 'BUY',
  volumeLots: 'Volume (lots)', orderPrice: 'Order price', slPrice: 'Stop Loss (price)', tpPrice: 'Take Profit (price)', optional: 'optional',
  contractInfo: 'Contract: {size} · Lots {min}–{max} · Pip {pip}',
  // positions
  slPrompt: 'Stop Loss (empty = none)', tpPrompt: 'Take Profit (empty = none)',
  tabPositions: 'Positions', tabPending: 'Pending orders', tabHistory: 'History',
  resetDemo: 'Reset demo', resetConfirm: 'Reset the demo account?',
  thSide: 'Side', thLots: 'Lots', thOpen: 'Open', thClose: 'Close', thType: 'Type', thPrice: 'Price', thReason: 'Reason', thTime: 'Time',
  thComm: 'Comm.', btnSlTp: 'SL/TP', btnClose: 'Close', btnCancel: 'Cancel',
  'reason.manual': 'manual', 'reason.sl': 'stop loss', 'reason.tp': 'take profit', 'reason.stopout': 'stop-out',
  // chart
  candles: 'Candles', line: 'Line', area: 'Area',
  // admin
  adminKey: 'Admin key', loading: 'Loading…', saved: 'Saved: the new prices are live immediately',
  adminTitle: 'Pricing · Spreads · Swaps', saveChanges: 'Save changes', discard: 'Discard', restoreDefaults: 'Restore defaults',
  restoreConfirm: 'Restore the defaults of all groups?', runRollover: 'Run rollover now', rolloverApplied: 'Rollover applied to {n} positions',
  groupSettings: 'Group settings', leverage: 'Leverage', marginCall: 'Margin call %', stopOut: 'Stop-out %',
  swapMarkup: 'Swap markup %', rolloverHour: 'Rollover (UTC hour)', islamic: 'Islamic account (swap-free)',
  swapMarkupHint: "The swap markup increases charges and reduces credits compared with the instrument's base value.",
  previewTitle: 'Client price preview (live)', providerRaw: 'Provider (raw)', client: 'Client', spreadPips: 'Spread (pips)',
  swapLongShort: 'Swap long / short', commissionLot: 'Commission / lot', perSide: '{n} USD per side',
  saveToPreview: 'Save to see the effect of your changes in the preview.',
  classTitle: 'Spreads and commissions by asset class', thClass: 'Class', thMode: 'Mode', thValue: 'Value',
  thMin: 'Min (pips)', thMax: 'Max (pips)', thCommissionLot: 'Commission / lot (USD)',
  overridesTitle: 'Per-symbol spread overrides · Per-symbol swaps',
  overridesHint: "Leave “—” to inherit the class rule. The swap starts from the instrument's base value: an override replaces it.",
  thRawSpread: 'Raw spread (pips)', thSpreadOverride: 'Spread override', thSwapOverride: 'Swap override',
  set: '— set', edit: 'edit', base: 'base',
  sessionsTitle: 'Sessions · spread widening (news, rollover, market opens)',
  thName: 'Name', thFrom: 'From (UTC)', thTo: 'To (UTC)', thMultiplier: 'Multiplier', thDays: 'Days',
  newSession: 'New session', addSession: '+ Add session',
  'mode.raw': 'Raw (no markup)', 'mode.markup_pips': 'Markup in pips', 'mode.markup_pct': 'Markup in %', 'mode.fixed': 'Fixed (pips)',
  'swap.pips': 'Pips / lot', 'swap.percent': '% per year', 'swap.money': 'USD / lot',
  day0: 'Sun', day1: 'Mon', day2: 'Tue', day3: 'Wed', day4: 'Thu', day5: 'Fri', day6: 'Sat',
  // default account groups
  'group.standard': 'Standard · spread with markup', 'group.ecn': 'ECN · raw spread + commission',
  'group.islamic': 'Islamic · swap-free', 'group.fixed': 'Fixed spread (market maker)',
  // instrument names
  'name.XAUUSD': 'Gold', 'name.XAGUSD': 'Silver', 'name.XPTUSD': 'Platinum', 'name.XPDUSD': 'Palladium', 'name.COPPER': 'Copper',
  'name.USOIL': 'WTI Crude Oil', 'name.UKOIL': 'Brent Crude Oil', 'name.NGAS': 'Natural Gas', 'name.TTF': 'TTF Gas',
  'name.URANIUM': 'Uranium', 'name.CORN': 'Corn', 'name.WHEAT': 'Wheat', 'name.ALUMINIUM': 'Aluminium',
  // server errors
  'err.insufficientMargin': 'Insufficient margin (required {req}, free {free})',
  'err.volumeLimits': 'Volume out of limits ({min}–{max})', 'err.volumeStep': 'Volume step is {step}',
  'err.slTpBuy': 'Invalid SL/TP for a buy', 'err.slTpSell': 'Invalid SL/TP for a sell',
  'err.noPrice': 'No price available', 'err.pendingInvalid': 'The pending order price is not valid relative to the market',
  'err.positionNotFound': 'Position not found', 'err.adminKey': 'Admin key missing or wrong',
} as const;
export type Key = keyof typeof en;
type Dict = Record<Key, string>;

const es: Dict = {
  balance: 'Saldo', equity: 'Equity', margin: 'Margen', freeMargin: 'Margen libre', level: 'Nivel', pnl: 'P&G',
  accountGroup: 'Grupo de cuenta (spread/swap)', connected: 'Conectado', disconnected: 'Desconectado',
  pricingAdmin: '⚙ Admin de precios', language: 'Idioma',
  navMarkets: 'Mercados', navChart: 'Gráfico', navOrder: 'Orden', navPositions: 'Posiciones',
  'cls.forex': 'Forex', 'cls.crypto': 'Cripto', 'cls.index': 'Índices', 'cls.commodity': 'Materias primas', 'cls.stock': 'Acciones',
  'src.binance': 'En vivo · Binance', 'src.hyperliquid': 'En vivo · Hyperliquid', 'src.kraken': 'En vivo · Kraken',
  'src.cross': 'En vivo · cruce calculado con pares en vivo', 'src.sim': 'SIMULADO · sin fuente gratuita en vivo',
  'src.demo': 'DEMO · instantánea de precios reales continuada por simulación', ok: 'Aceptar',
  demoBanner: 'Modo demo: los precios son una instantánea real del mercado tomada el {date}, continuada por simulación. Los precios en vivo están disponibles al ejecutar la plataforma en tu ordenador o en un servidor.',
  searchInstr: 'Buscar entre {n} instrumentos…', all: 'Todos', symbol: 'Símbolo', bid: 'Bid', ask: 'Ask', noResults: 'No se encontraron instrumentos.',
  buyExecuted: 'Compra ejecutada', sellExecuted: 'Venta ejecutada', pendingPlaced: 'Orden pendiente creada',
  market: 'Mercado', limit: 'Limit', stop: 'Stop', sell: 'VENDER', buy: 'COMPRAR',
  volumeLots: 'Volumen (lotes)', orderPrice: 'Precio de la orden', slPrice: 'Stop Loss (precio)', tpPrice: 'Take Profit (precio)', optional: 'opcional',
  contractInfo: 'Contrato: {size} · Lotes {min}–{max} · Pip {pip}',
  slPrompt: 'Stop Loss (vacío = ninguno)', tpPrompt: 'Take Profit (vacío = ninguno)',
  tabPositions: 'Posiciones', tabPending: 'Órdenes pendientes', tabHistory: 'Historial',
  resetDemo: 'Reiniciar demo', resetConfirm: '¿Reiniciar la cuenta demo?',
  thSide: 'Lado', thLots: 'Lotes', thOpen: 'Apertura', thClose: 'Cierre', thType: 'Tipo', thPrice: 'Precio', thReason: 'Motivo', thTime: 'Hora',
  thComm: 'Comis.', btnSlTp: 'SL/TP', btnClose: 'Cerrar', btnCancel: 'Cancelar',
  'reason.manual': 'manual', 'reason.sl': 'stop loss', 'reason.tp': 'take profit', 'reason.stopout': 'stop-out',
  candles: 'Velas', line: 'Línea', area: 'Área',
  adminKey: 'Clave de administrador', loading: 'Cargando…', saved: 'Guardado: los nuevos precios están activos al instante',
  adminTitle: 'Precios · Spreads · Swaps', saveChanges: 'Guardar cambios', discard: 'Descartar', restoreDefaults: 'Restaurar valores por defecto',
  restoreConfirm: '¿Restaurar los valores por defecto de todos los grupos?', runRollover: 'Ejecutar rollover ahora', rolloverApplied: 'Rollover aplicado a {n} posiciones',
  groupSettings: 'Ajustes del grupo', leverage: 'Apalancamiento', marginCall: 'Margin call %', stopOut: 'Stop-out %',
  swapMarkup: 'Recargo de swap %', rolloverHour: 'Rollover (hora UTC)', islamic: 'Cuenta islámica (sin swap)',
  swapMarkupHint: 'El recargo de swap aumenta los cargos y reduce los abonos respecto al valor base del instrumento.',
  previewTitle: 'Vista previa del precio al cliente (en vivo)', providerRaw: 'Proveedor (bruto)', client: 'Cliente', spreadPips: 'Spread (pips)',
  swapLongShort: 'Swap largo / corto', commissionLot: 'Comisión / lote', perSide: '{n} USD por lado',
  saveToPreview: 'Guarda para ver el efecto de tus cambios en la vista previa.',
  classTitle: 'Spreads y comisiones por clase de activo', thClass: 'Clase', thMode: 'Modo', thValue: 'Valor',
  thMin: 'Mín (pips)', thMax: 'Máx (pips)', thCommissionLot: 'Comisión / lote (USD)',
  overridesTitle: 'Spread por símbolo · Swap por símbolo',
  overridesHint: 'Deja “—” para heredar la regla de la clase. El swap parte del valor base del instrumento: un ajuste lo sustituye.',
  thRawSpread: 'Spread bruto (pips)', thSpreadOverride: 'Spread personalizado', thSwapOverride: 'Swap personalizado',
  set: '— definir', edit: 'editar', base: 'base',
  sessionsTitle: 'Sesiones · ampliación del spread (noticias, rollover, aperturas)',
  thName: 'Nombre', thFrom: 'Desde (UTC)', thTo: 'Hasta (UTC)', thMultiplier: 'Multiplicador', thDays: 'Días',
  newSession: 'Nueva sesión', addSession: '+ Añadir sesión',
  'mode.raw': 'Bruto (sin recargo)', 'mode.markup_pips': 'Recargo en pips', 'mode.markup_pct': 'Recargo en %', 'mode.fixed': 'Fijo (pips)',
  'swap.pips': 'Pips / lote', 'swap.percent': '% anual', 'swap.money': 'USD / lote',
  day0: 'Dom', day1: 'Lun', day2: 'Mar', day3: 'Mié', day4: 'Jue', day5: 'Vie', day6: 'Sáb',
  'group.standard': 'Estándar · spread con recargo', 'group.ecn': 'ECN · spread bruto + comisión',
  'group.islamic': 'Islámica · sin swap', 'group.fixed': 'Spread fijo (market maker)',
  'name.XAUUSD': 'Oro', 'name.XAGUSD': 'Plata', 'name.XPTUSD': 'Platino', 'name.XPDUSD': 'Paladio', 'name.COPPER': 'Cobre',
  'name.USOIL': 'Petróleo WTI', 'name.UKOIL': 'Petróleo Brent', 'name.NGAS': 'Gas natural', 'name.TTF': 'Gas TTF',
  'name.URANIUM': 'Uranio', 'name.CORN': 'Maíz', 'name.WHEAT': 'Trigo', 'name.ALUMINIUM': 'Aluminio',
  'err.insufficientMargin': 'Margen insuficiente (requerido {req}, libre {free})',
  'err.volumeLimits': 'Volumen fuera de límites ({min}–{max})', 'err.volumeStep': 'El paso de volumen es {step}',
  'err.slTpBuy': 'SL/TP no válidos para una compra', 'err.slTpSell': 'SL/TP no válidos para una venta',
  'err.noPrice': 'No hay precio disponible', 'err.pendingInvalid': 'El precio de la orden pendiente no es válido respecto al mercado',
  'err.positionNotFound': 'Posición no encontrada', 'err.adminKey': 'Falta la clave de administrador o es incorrecta',
};

const it: Dict = {
  balance: 'Saldo', equity: 'Equity', margin: 'Margine', freeMargin: 'Margine libero', level: 'Livello', pnl: 'P&L',
  accountGroup: 'Gruppo di conto (spread/swap)', connected: 'Connesso', disconnected: 'Disconnesso',
  pricingAdmin: '⚙ Admin prezzi', language: 'Lingua',
  navMarkets: 'Mercati', navChart: 'Grafico', navOrder: 'Ordine', navPositions: 'Posizioni',
  'cls.forex': 'Forex', 'cls.crypto': 'Crypto', 'cls.index': 'Indici', 'cls.commodity': 'Materie prime', 'cls.stock': 'Azioni',
  'src.binance': 'Live · Binance', 'src.hyperliquid': 'Live · Hyperliquid', 'src.kraken': 'Live · Kraken',
  'src.cross': 'Live · cambio incrociato calcolato da coppie live', 'src.sim': 'SIMULATO · nessuna fonte live gratuita',
  'src.demo': 'DEMO · fotografia dei prezzi reali proseguita con simulazione', ok: 'OK',
  demoBanner: 'Modalità demo: i prezzi sono una fotografia reale del mercato scattata il {date}, proseguita con simulazione. I prezzi live sono disponibili eseguendo la piattaforma sul tuo computer o su un server.',
  searchInstr: 'Cerca tra {n} strumenti…', all: 'Tutti', symbol: 'Simbolo', bid: 'Bid', ask: 'Ask', noResults: 'Nessuno strumento trovato.',
  buyExecuted: 'Acquisto eseguito', sellExecuted: 'Vendita eseguita', pendingPlaced: 'Ordine pendente inserito',
  market: 'Mercato', limit: 'Limit', stop: 'Stop', sell: 'VENDI', buy: 'COMPRA',
  volumeLots: 'Volume (lotti)', orderPrice: 'Prezzo ordine', slPrice: 'Stop Loss (prezzo)', tpPrice: 'Take Profit (prezzo)', optional: 'opzionale',
  contractInfo: 'Contratto: {size} · Lotti {min}–{max} · Pip {pip}',
  slPrompt: 'Stop Loss (vuoto = nessuno)', tpPrompt: 'Take Profit (vuoto = nessuno)',
  tabPositions: 'Posizioni', tabPending: 'Ordini pendenti', tabHistory: 'Storico',
  resetDemo: 'Reset demo', resetConfirm: 'Azzerare il conto demo?',
  thSide: 'Lato', thLots: 'Lotti', thOpen: 'Apertura', thClose: 'Chiusura', thType: 'Tipo', thPrice: 'Prezzo', thReason: 'Motivo', thTime: 'Ora',
  thComm: 'Comm.', btnSlTp: 'SL/TP', btnClose: 'Chiudi', btnCancel: 'Annulla',
  'reason.manual': 'manuale', 'reason.sl': 'stop loss', 'reason.tp': 'take profit', 'reason.stopout': 'stop-out',
  candles: 'Candele', line: 'Linea', area: 'Area',
  adminKey: 'Chiave admin', loading: 'Caricamento…', saved: 'Salvato: i nuovi prezzi sono attivi subito',
  adminTitle: 'Prezzi · Spread · Swap', saveChanges: 'Salva modifiche', discard: 'Annulla', restoreDefaults: 'Ripristina predefiniti',
  restoreConfirm: 'Ripristinare i valori predefiniti di tutti i gruppi?', runRollover: 'Esegui rollover ora', rolloverApplied: 'Rollover eseguito su {n} posizioni',
  groupSettings: 'Parametri del gruppo', leverage: 'Leva', marginCall: 'Margin call %', stopOut: 'Stop-out %',
  swapMarkup: 'Maggiorazione swap %', rolloverHour: 'Rollover (ora UTC)', islamic: 'Conto islamico (swap-free)',
  swapMarkupHint: 'La maggiorazione swap aumenta gli addebiti e riduce gli accrediti rispetto al valore base dello strumento.',
  previewTitle: 'Anteprima prezzo cliente (live)', providerRaw: 'Provider (grezzo)', client: 'Cliente', spreadPips: 'Spread (pip)',
  swapLongShort: 'Swap long / short', commissionLot: 'Commissione / lotto', perSide: '{n} USD per lato',
  saveToPreview: "Salva per vedere l'effetto delle modifiche nell'anteprima.",
  classTitle: 'Spread e commissioni per classe di asset', thClass: 'Classe', thMode: 'Modalità', thValue: 'Valore',
  thMin: 'Min (pip)', thMax: 'Max (pip)', thCommissionLot: 'Commissione / lotto (USD)',
  overridesTitle: 'Override per simbolo · Swap per simbolo',
  overridesHint: 'Lascia “—” per ereditare la regola di classe. Lo swap parte dal valore base dello strumento: un override lo sostituisce.',
  thRawSpread: 'Spread grezzo (pip)', thSpreadOverride: 'Override spread', thSwapOverride: 'Override swap',
  set: '— imposta', edit: 'modifica', base: 'base',
  sessionsTitle: 'Sessioni · allargamento spread (news, rollover, aperture)',
  thName: 'Nome', thFrom: 'Da (UTC)', thTo: 'A (UTC)', thMultiplier: 'Moltiplicatore', thDays: 'Giorni',
  newSession: 'Nuova sessione', addSession: '+ Aggiungi sessione',
  'mode.raw': 'Grezzo (nessun markup)', 'mode.markup_pips': 'Markup in pip', 'mode.markup_pct': 'Markup in %', 'mode.fixed': 'Fisso (pip)',
  'swap.pips': 'Pip / lotto', 'swap.percent': '% annua', 'swap.money': 'USD / lotto',
  day0: 'Dom', day1: 'Lun', day2: 'Mar', day3: 'Mer', day4: 'Gio', day5: 'Ven', day6: 'Sab',
  'group.standard': 'Standard · spread con markup', 'group.ecn': 'ECN · spread grezzo + commissione',
  'group.islamic': 'Islamico · senza swap', 'group.fixed': 'Spread fisso (market maker)',
  'name.XAUUSD': 'Oro', 'name.XAGUSD': 'Argento', 'name.XPTUSD': 'Platino', 'name.XPDUSD': 'Palladio', 'name.COPPER': 'Rame',
  'name.USOIL': 'Petrolio WTI', 'name.UKOIL': 'Petrolio Brent', 'name.NGAS': 'Gas naturale', 'name.TTF': 'Gas TTF',
  'name.URANIUM': 'Uranio', 'name.CORN': 'Mais', 'name.WHEAT': 'Grano', 'name.ALUMINIUM': 'Alluminio',
  'err.insufficientMargin': 'Margine insufficiente (richiesto {req}, libero {free})',
  'err.volumeLimits': 'Volume fuori limiti ({min}–{max})', 'err.volumeStep': 'Il passo del volume è {step}',
  'err.slTpBuy': 'SL/TP non validi per un acquisto', 'err.slTpSell': 'SL/TP non validi per una vendita',
  'err.noPrice': 'Nessun prezzo disponibile', 'err.pendingInvalid': "Il prezzo dell'ordine pendente non è valido rispetto al mercato",
  'err.positionNotFound': 'Posizione non trovata', 'err.adminKey': 'Chiave amministratore mancante o errata',
};

const fr: Dict = {
  balance: 'Solde', equity: 'Equity', margin: 'Marge', freeMargin: 'Marge libre', level: 'Niveau', pnl: 'P&L',
  accountGroup: 'Groupe de compte (spread/swap)', connected: 'Connecté', disconnected: 'Déconnecté',
  pricingAdmin: '⚙ Admin des prix', language: 'Langue',
  navMarkets: 'Marchés', navChart: 'Graphique', navOrder: 'Ordre', navPositions: 'Positions',
  'cls.forex': 'Forex', 'cls.crypto': 'Crypto', 'cls.index': 'Indices', 'cls.commodity': 'Matières premières', 'cls.stock': 'Actions',
  'src.binance': 'En direct · Binance', 'src.hyperliquid': 'En direct · Hyperliquid', 'src.kraken': 'En direct · Kraken',
  'src.cross': 'En direct · taux croisé calculé à partir de paires en direct', 'src.sim': 'SIMULÉ · aucune source gratuite en direct',
  'src.demo': 'DÉMO · instantané de prix réels prolongé par simulation', ok: 'OK',
  demoBanner: 'Mode démo : les prix sont un instantané réel du marché pris le {date}, prolongé par simulation. Les prix en direct sont disponibles en exécutant la plateforme sur votre ordinateur ou un serveur.',
  searchInstr: 'Rechercher parmi {n} instruments…', all: 'Tous', symbol: 'Symbole', bid: 'Bid', ask: 'Ask', noResults: 'Aucun instrument trouvé.',
  buyExecuted: 'Achat exécuté', sellExecuted: 'Vente exécutée', pendingPlaced: 'Ordre en attente créé',
  market: 'Marché', limit: 'Limit', stop: 'Stop', sell: 'VENDRE', buy: 'ACHETER',
  volumeLots: 'Volume (lots)', orderPrice: "Prix de l'ordre", slPrice: 'Stop Loss (prix)', tpPrice: 'Take Profit (prix)', optional: 'facultatif',
  contractInfo: 'Contrat : {size} · Lots {min}–{max} · Pip {pip}',
  slPrompt: 'Stop Loss (vide = aucun)', tpPrompt: 'Take Profit (vide = aucun)',
  tabPositions: 'Positions', tabPending: 'Ordres en attente', tabHistory: 'Historique',
  resetDemo: 'Réinitialiser la démo', resetConfirm: 'Réinitialiser le compte démo ?',
  thSide: 'Sens', thLots: 'Lots', thOpen: 'Ouverture', thClose: 'Clôture', thType: 'Type', thPrice: 'Prix', thReason: 'Motif', thTime: 'Heure',
  thComm: 'Comm.', btnSlTp: 'SL/TP', btnClose: 'Clôturer', btnCancel: 'Annuler',
  'reason.manual': 'manuel', 'reason.sl': 'stop loss', 'reason.tp': 'take profit', 'reason.stopout': 'stop-out',
  candles: 'Bougies', line: 'Ligne', area: 'Aire',
  adminKey: 'Clé administrateur', loading: 'Chargement…', saved: 'Enregistré : les nouveaux prix sont actifs immédiatement',
  adminTitle: 'Prix · Spreads · Swaps', saveChanges: 'Enregistrer', discard: 'Annuler', restoreDefaults: 'Rétablir les valeurs par défaut',
  restoreConfirm: 'Rétablir les valeurs par défaut de tous les groupes ?', runRollover: 'Lancer le rollover maintenant', rolloverApplied: 'Rollover appliqué à {n} positions',
  groupSettings: 'Paramètres du groupe', leverage: 'Effet de levier', marginCall: 'Margin call %', stopOut: 'Stop-out %',
  swapMarkup: 'Majoration du swap %', rolloverHour: 'Rollover (heure UTC)', islamic: 'Compte islamique (sans swap)',
  swapMarkupHint: 'La majoration du swap augmente les débits et réduit les crédits par rapport à la valeur de base de l’instrument.',
  previewTitle: 'Aperçu du prix client (en direct)', providerRaw: 'Fournisseur (brut)', client: 'Client', spreadPips: 'Spread (pips)',
  swapLongShort: 'Swap long / short', commissionLot: 'Commission / lot', perSide: '{n} USD par côté',
  saveToPreview: 'Enregistrez pour voir l’effet de vos modifications dans l’aperçu.',
  classTitle: 'Spreads et commissions par classe d’actifs', thClass: 'Classe', thMode: 'Mode', thValue: 'Valeur',
  thMin: 'Min (pips)', thMax: 'Max (pips)', thCommissionLot: 'Commission / lot (USD)',
  overridesTitle: 'Spread par symbole · Swap par symbole',
  overridesHint: 'Laissez « — » pour hériter de la règle de la classe. Le swap part de la valeur de base de l’instrument : une personnalisation la remplace.',
  thRawSpread: 'Spread brut (pips)', thSpreadOverride: 'Spread personnalisé', thSwapOverride: 'Swap personnalisé',
  set: '— définir', edit: 'modifier', base: 'base',
  sessionsTitle: 'Sessions · élargissement du spread (actualités, rollover, ouvertures)',
  thName: 'Nom', thFrom: 'De (UTC)', thTo: 'À (UTC)', thMultiplier: 'Multiplicateur', thDays: 'Jours',
  newSession: 'Nouvelle session', addSession: '+ Ajouter une session',
  'mode.raw': 'Brut (sans majoration)', 'mode.markup_pips': 'Majoration en pips', 'mode.markup_pct': 'Majoration en %', 'mode.fixed': 'Fixe (pips)',
  'swap.pips': 'Pips / lot', 'swap.percent': '% annuel', 'swap.money': 'USD / lot',
  day0: 'Dim', day1: 'Lun', day2: 'Mar', day3: 'Mer', day4: 'Jeu', day5: 'Ven', day6: 'Sam',
  'group.standard': 'Standard · spread avec majoration', 'group.ecn': 'ECN · spread brut + commission',
  'group.islamic': 'Islamique · sans swap', 'group.fixed': 'Spread fixe (market maker)',
  'name.XAUUSD': 'Or', 'name.XAGUSD': 'Argent', 'name.XPTUSD': 'Platine', 'name.XPDUSD': 'Palladium', 'name.COPPER': 'Cuivre',
  'name.USOIL': 'Pétrole WTI', 'name.UKOIL': 'Pétrole Brent', 'name.NGAS': 'Gaz naturel', 'name.TTF': 'Gaz TTF',
  'name.URANIUM': 'Uranium', 'name.CORN': 'Maïs', 'name.WHEAT': 'Blé', 'name.ALUMINIUM': 'Aluminium',
  'err.insufficientMargin': 'Marge insuffisante (requis {req}, libre {free})',
  'err.volumeLimits': 'Volume hors limites ({min}–{max})', 'err.volumeStep': 'Le pas de volume est {step}',
  'err.slTpBuy': 'SL/TP invalides pour un achat', 'err.slTpSell': 'SL/TP invalides pour une vente',
  'err.noPrice': 'Aucun prix disponible', 'err.pendingInvalid': 'Le prix de l’ordre en attente n’est pas valide par rapport au marché',
  'err.positionNotFound': 'Position introuvable', 'err.adminKey': 'Clé administrateur manquante ou incorrecte',
};

const pt: Dict = {
  balance: 'Saldo', equity: 'Equity', margin: 'Margem', freeMargin: 'Margem livre', level: 'Nível', pnl: 'P&L',
  accountGroup: 'Grupo da conta (spread/swap)', connected: 'Ligado', disconnected: 'Desligado',
  pricingAdmin: '⚙ Admin de preços', language: 'Idioma',
  navMarkets: 'Mercados', navChart: 'Gráfico', navOrder: 'Ordem', navPositions: 'Posições',
  'cls.forex': 'Forex', 'cls.crypto': 'Cripto', 'cls.index': 'Índices', 'cls.commodity': 'Matérias-primas', 'cls.stock': 'Ações',
  'src.binance': 'Ao vivo · Binance', 'src.hyperliquid': 'Ao vivo · Hyperliquid', 'src.kraken': 'Ao vivo · Kraken',
  'src.cross': 'Ao vivo · câmbio cruzado calculado a partir de pares ao vivo', 'src.sim': 'SIMULADO · sem fonte gratuita ao vivo',
  'src.demo': 'DEMO · captura de preços reais continuada por simulação', ok: 'OK',
  demoBanner: 'Modo demo: os preços são uma captura real do mercado feita a {date}, continuada por simulação. Os preços ao vivo estão disponíveis ao executar a plataforma no seu computador ou num servidor.',
  searchInstr: 'Pesquisar entre {n} instrumentos…', all: 'Todos', symbol: 'Símbolo', bid: 'Bid', ask: 'Ask', noResults: 'Nenhum instrumento encontrado.',
  buyExecuted: 'Compra executada', sellExecuted: 'Venda executada', pendingPlaced: 'Ordem pendente criada',
  market: 'Mercado', limit: 'Limit', stop: 'Stop', sell: 'VENDER', buy: 'COMPRAR',
  volumeLots: 'Volume (lotes)', orderPrice: 'Preço da ordem', slPrice: 'Stop Loss (preço)', tpPrice: 'Take Profit (preço)', optional: 'opcional',
  contractInfo: 'Contrato: {size} · Lotes {min}–{max} · Pip {pip}',
  slPrompt: 'Stop Loss (vazio = nenhum)', tpPrompt: 'Take Profit (vazio = nenhum)',
  tabPositions: 'Posições', tabPending: 'Ordens pendentes', tabHistory: 'Histórico',
  resetDemo: 'Repor demo', resetConfirm: 'Repor a conta demo?',
  thSide: 'Lado', thLots: 'Lotes', thOpen: 'Abertura', thClose: 'Fecho', thType: 'Tipo', thPrice: 'Preço', thReason: 'Motivo', thTime: 'Hora',
  thComm: 'Com.', btnSlTp: 'SL/TP', btnClose: 'Fechar', btnCancel: 'Cancelar',
  'reason.manual': 'manual', 'reason.sl': 'stop loss', 'reason.tp': 'take profit', 'reason.stopout': 'stop-out',
  candles: 'Velas', line: 'Linha', area: 'Área',
  adminKey: 'Chave de administrador', loading: 'A carregar…', saved: 'Guardado: os novos preços estão ativos de imediato',
  adminTitle: 'Preços · Spreads · Swaps', saveChanges: 'Guardar alterações', discard: 'Descartar', restoreDefaults: 'Repor predefinições',
  restoreConfirm: 'Repor as predefinições de todos os grupos?', runRollover: 'Executar rollover agora', rolloverApplied: 'Rollover aplicado a {n} posições',
  groupSettings: 'Definições do grupo', leverage: 'Alavancagem', marginCall: 'Margin call %', stopOut: 'Stop-out %',
  swapMarkup: 'Majoração do swap %', rolloverHour: 'Rollover (hora UTC)', islamic: 'Conta islâmica (sem swap)',
  swapMarkupHint: 'A majoração do swap aumenta os débitos e reduz os créditos face ao valor base do instrumento.',
  previewTitle: 'Pré-visualização do preço do cliente (ao vivo)', providerRaw: 'Fornecedor (bruto)', client: 'Cliente', spreadPips: 'Spread (pips)',
  swapLongShort: 'Swap long / short', commissionLot: 'Comissão / lote', perSide: '{n} USD por lado',
  saveToPreview: 'Guarde para ver o efeito das alterações na pré-visualização.',
  classTitle: 'Spreads e comissões por classe de ativos', thClass: 'Classe', thMode: 'Modo', thValue: 'Valor',
  thMin: 'Mín (pips)', thMax: 'Máx (pips)', thCommissionLot: 'Comissão / lote (USD)',
  overridesTitle: 'Spread por símbolo · Swap por símbolo',
  overridesHint: 'Deixe “—” para herdar a regra da classe. O swap parte do valor base do instrumento: uma personalização substitui-o.',
  thRawSpread: 'Spread bruto (pips)', thSpreadOverride: 'Spread personalizado', thSwapOverride: 'Swap personalizado',
  set: '— definir', edit: 'editar', base: 'base',
  sessionsTitle: 'Sessões · alargamento do spread (notícias, rollover, aberturas)',
  thName: 'Nome', thFrom: 'De (UTC)', thTo: 'Até (UTC)', thMultiplier: 'Multiplicador', thDays: 'Dias',
  newSession: 'Nova sessão', addSession: '+ Adicionar sessão',
  'mode.raw': 'Bruto (sem majoração)', 'mode.markup_pips': 'Majoração em pips', 'mode.markup_pct': 'Majoração em %', 'mode.fixed': 'Fixo (pips)',
  'swap.pips': 'Pips / lote', 'swap.percent': '% anual', 'swap.money': 'USD / lote',
  day0: 'Dom', day1: 'Seg', day2: 'Ter', day3: 'Qua', day4: 'Qui', day5: 'Sex', day6: 'Sáb',
  'group.standard': 'Standard · spread com majoração', 'group.ecn': 'ECN · spread bruto + comissão',
  'group.islamic': 'Islâmica · sem swap', 'group.fixed': 'Spread fixo (market maker)',
  'name.XAUUSD': 'Ouro', 'name.XAGUSD': 'Prata', 'name.XPTUSD': 'Platina', 'name.XPDUSD': 'Paládio', 'name.COPPER': 'Cobre',
  'name.USOIL': 'Petróleo WTI', 'name.UKOIL': 'Petróleo Brent', 'name.NGAS': 'Gás natural', 'name.TTF': 'Gás TTF',
  'name.URANIUM': 'Urânio', 'name.CORN': 'Milho', 'name.WHEAT': 'Trigo', 'name.ALUMINIUM': 'Alumínio',
  'err.insufficientMargin': 'Margem insuficiente (necessário {req}, livre {free})',
  'err.volumeLimits': 'Volume fora dos limites ({min}–{max})', 'err.volumeStep': 'O passo do volume é {step}',
  'err.slTpBuy': 'SL/TP inválidos para uma compra', 'err.slTpSell': 'SL/TP inválidos para uma venda',
  'err.noPrice': 'Nenhum preço disponível', 'err.pendingInvalid': 'O preço da ordem pendente não é válido face ao mercado',
  'err.positionNotFound': 'Posição não encontrada', 'err.adminKey': 'Chave de administrador em falta ou incorreta',
};

const DICTS: Record<Lang, Dict> = { en, es, it, fr, pt };

function initial(): Lang {
  try {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch { /* storage unavailable */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return (nav in DICTS ? nav : 'en') as Lang;
}

let lang: Lang = initial();
const subs = new Set<() => void>();
const apply = () => { if (typeof document !== 'undefined') document.documentElement.lang = lang; };
apply();

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('lang', l); } catch { /* storage unavailable */ }
  apply();
  subs.forEach((f) => f());
}

/** Components call this so they re-render when the language changes. */
export const useLang = (): Lang => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => lang);

export function t(key: Key, params?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? en[key];
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : s;
}

export const locale = () => LOCALES[lang];

/** Instrument display name, translated where we have a translation (commodities). */
export const instName = (symbol: string, fallback: string) => {
  const k = `name.${symbol}` as Key;
  return k in en ? t(k) : fallback;
};

/** Default account groups get a translated label; custom groups keep their own name. */
export const groupName = (id: string, fallback: string) => {
  const k = `group.${id}` as Key;
  return k in en ? t(k) : fallback;
};

const ERRORS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^insufficient margin \(required ([\d.]+), free (-?[\d.]+)\)/, (m) => t('err.insufficientMargin', { req: m[1], free: m[2] })],
  [/^volume out of limits \(([\d.]+)–([\d.]+)\)/, (m) => t('err.volumeLimits', { min: m[1], max: m[2] })],
  [/^volume step ([\d.]+)/, (m) => t('err.volumeStep', { step: m[1] })],
  [/^invalid SL\/TP for a buy/, () => t('err.slTpBuy')],
  [/^invalid SL\/TP for a sell/, () => t('err.slTpSell')],
  [/^no price available/, () => t('err.noPrice')],
  [/^pending order price is not valid/, () => t('err.pendingInvalid')],
  [/^position not found/, () => t('err.positionNotFound')],
  [/^admin key missing or wrong/, () => t('err.adminKey')],
];

/** Translates the (English) error messages sent by the server; unknown messages are shown as they are. */
export function tErr(message: string): string {
  for (const [re, fn] of ERRORS) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}
