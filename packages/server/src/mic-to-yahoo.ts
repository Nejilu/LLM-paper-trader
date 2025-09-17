export const MIC_TO_SUFFIX: Record<string, string> = {
  XNAS: "", // Nasdaq Global Market (US)
  XNYS: "", // NYSE (US)
  XASE: "", // NYSE American (US)
  ARCX: "", // NYSE Arca (US)
  XNGS: "", // Nasdaq Global Select (US)
  XPAR: ".PA", // Euronext Paris (France)
  XLON: ".L", // London Stock Exchange (UK)
  XETR: ".DE", // Deutsche Boerse Xetra (Germany)
  XFRA: ".F", // Frankfurt Floor (Germany)
  XAMS: ".AS", // Euronext Amsterdam (Netherlands)
  XBRU: ".BR", // Euronext Brussels (Belgium)
  XSWX: ".SW", // SIX Swiss Exchange (Switzerland)
  XSTO: ".ST", // Nasdaq Stockholm (Sweden)
  XCSE: ".CO", // Nasdaq Copenhagen (Denmark)
  XHEL: ".HE", // Nasdaq Helsinki (Finland)
  XOSL: ".OL", // Oslo Bors (Norway)
  XTSE: ".TO", // Toronto Stock Exchange (Canada)
  XTSX: ".V", // TSX Venture Exchange (Canada)
  XHKG: ".HK", // Hong Kong Exchanges (Hong Kong)
  XSES: ".SI", // Singapore Exchange (Singapore)
  XTAI: ".TW", // Taiwan Stock Exchange (Taiwan)
  XKRX: ".KS", // Korea Exchange (KOSPI)
  XKOS: ".KQ", // KOSDAQ (South Korea)
  XNSE: ".NS", // National Stock Exchange (India)
  XBOM: ".BO", // Bombay Stock Exchange (India)
  MTAA: ".MI", // Borsa Italiana (Italy)
  XMAD: ".MC", // Bolsa de Madrid (Spain)
  XASX: ".AX", // Australian Securities Exchange (Australia)
  XNZE: ".NZ", // New Zealand Exchange (New Zealand)
  BVMF: ".SA", // B3 Brasil Bolsa Balcao (Brazil)
  XMEX: ".MX", // Bolsa Mexicana de Valores (Mexico)
  XBVC: ".LS", // Euronext Lisbon (Portugal)
  XBUE: ".BA", // Buenos Aires Stock Exchange (Argentina)
  XJSE: ".JO", // Johannesburg Stock Exchange (South Africa)
  XDUB: ".IR", // Euronext Dublin (Ireland)
  XWAR: ".WA", // Warsaw Stock Exchange (Poland)
  XSGO: ".SN", // Santiago Stock Exchange (Chile)
  XIDX: ".JK", // Indonesia Stock Exchange (Indonesia)
  XTAE: ".TA" // Tel Aviv Stock Exchange (Israel)
};

// TODO: add additional MIC to Yahoo suffix mappings for less common venues (Middle East, Africa, LatAm, OTC, etc.).

export function getYahooSuffixForMic(mic?: string | null): string | undefined {
  if (!mic) {
    return undefined;
  }
  const normalized = mic.toUpperCase();
  return MIC_TO_SUFFIX[normalized];
}

export function applyYahooSuffix(ticker: string, mic?: string | null): string | undefined {
  const suffix = getYahooSuffixForMic(mic);
  if (suffix === undefined) {
    return undefined;
  }
  return `${ticker}${suffix}`;
}
