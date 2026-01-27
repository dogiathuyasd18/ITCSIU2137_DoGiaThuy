export const formatVND = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 VND';

  const rounded = Math.round(n);
  // dot as thousands separator (Vietnam-style)
  const withDots = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots} VND`;
};

