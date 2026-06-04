import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── helpers ISO week ─────────────────────────────────────────────────────────

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // nearest Thursday
  const y = d.getFullYear();
  const jan1 = new Date(y, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return { week, year: y };
}

function weekValue(date: Date): string {
  const { week, year } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// "YYYY-WNN" → Monday of that ISO week
function mondayOfWeek(val: string): Date | null {
  const m = val.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = +m[1];
  const week = +m[2];
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday = new Date(monday1);
  monday.setDate(monday1.getDate() + (week - 1) * 7);
  return monday;
}

function displayLabel(val: string): string {
  if (!val) return '';
  const mon = mondayOfWeek(val);
  if (!mon) return val;
  const { week, year } = isoWeek(mon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  return `Semana ${week}, ${year}  ·  ${fmt(mon)} – ${fmt(sun)}`;
}

const DIAS = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Build calendar grid for a given month/year (rows = weeks, cols = Sun…Sat)
function buildGrid(year: number, month: number) {
  // First day to display: Sunday of the week containing the 1st
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // rewind to Sunday

  const rows: Date[][] = [];
  const cursor = new Date(start);
  while (rows.length < 6) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(row);
    // Stop if the next row would be entirely in next month
    if (cursor.getMonth() !== month && rows.length >= 4) break;
  }
  return rows;
}

// ─── component ───────────────────────────────────────────────────────────────

interface WeekPickerInputProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function WeekPickerInput({ value, onChange, className, style }: WeekPickerInputProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const mon = mondayOfWeek(value);
    return mon ? mon.getFullYear() : today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const mon = mondayOfWeek(value);
    return mon ? mon.getMonth() : today.getMonth();
  });
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Position the dropdown below the trigger
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({
      top: r.bottom + window.scrollY + 4,
      left: r.left + window.scrollX,
      width: Math.max(r.width, 310),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePos]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectWeek = (row: Date[]) => {
    // Monday is index 1 (LU column)
    const monday = row[1];
    onChange(weekValue(monday));
    setOpen(false);
  };

  const selectedMon = mondayOfWeek(value);
  const selectedWeekVal = selectedMon ? weekValue(selectedMon) : '';

  const grid = buildGrid(viewYear, viewMonth);

  const todayMon = new Date(today);
  todayMon.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const todayWeekVal = weekValue(todayMon);

  const isToday = (d: Date) =>
    d.toDateString() === today.toDateString();

  const isSelectedRow = (row: Date[]) => {
    if (!selectedWeekVal) return false;
    const mon = row[1];
    return weekValue(mon) === selectedWeekVal;
  };

  return (
    <>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={() => { updatePos(); setOpen(o => !o); }}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
          ...style,
        }}
      >
        <span style={{ flex: 1, color: value ? '#1f2937' : '#9ca3af', fontSize: 14 }}>
          {value ? displayLabel(value) : 'Semana --, ----'}
        </span>
        <CalendarDays size={18} color="#9ca3af" style={{ flexShrink: 0 }} />
      </div>

      {/* Dropdown via portal */}
      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'absolute',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            minWidth: 310,
            zIndex: 99999,
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            fontFamily: '"Montserrat", system-ui, sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Month navigation */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px 8px', borderBottom: '1px solid #f3f4f6',
          }}>
            <button
              onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#374151', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>
              {MESES[viewMonth]} de {viewYear}
            </span>
            <button
              onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: '#374151', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Calendar grid */}
          <div style={{ padding: '6px 8px' }}>
            {/* Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(7, 1fr)', marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textAlign: 'center', padding: '3px 0' }}>
                Sem.
              </span>
              {DIAS.map(d => (
                <span key={d} style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'center', padding: '3px 0' }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Rows */}
            {grid.map((row, ri) => {
              const mon = row[1];
              const { week } = isoWeek(mon);
              const selected = isSelectedRow(row);
              const isCurrentWeek = weekValue(mon) === todayWeekVal;

              return (
                <div
                  key={ri}
                  onClick={() => selectWeek(row)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px repeat(7, 1fr)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: selected ? '#00829a' : isCurrentWeek ? 'rgba(0,130,154,0.06)' : 'transparent',
                    marginBottom: 2,
                    transition: 'background-color 0.12s',
                  }}
                  onMouseEnter={e => {
                    if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,130,154,0.08)';
                  }}
                  onMouseLeave={e => {
                    if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = isCurrentWeek ? 'rgba(0,130,154,0.06)' : 'transparent';
                  }}
                >
                  {/* Week number */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: selected ? 'rgba(255,255,255,0.8)' : '#9ca3af',
                    textAlign: 'center', padding: '5px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {week}
                  </span>

                  {/* Days */}
                  {row.map((day, di) => {
                    const inMonth = day.getMonth() === viewMonth;
                    const todayDay = isToday(day);
                    return (
                      <span
                        key={di}
                        style={{
                          fontSize: 12,
                          fontWeight: todayDay ? 800 : 400,
                          color: selected
                            ? '#fff'
                            : todayDay
                              ? '#00829a'
                              : inMonth
                                ? '#1f2937'
                                : '#d1d5db',
                          textAlign: 'center',
                          padding: '5px 0',
                          borderRadius: todayDay && !selected ? 4 : 0,
                          backgroundColor: todayDay && !selected ? 'rgba(0,130,154,0.12)' : 'transparent',
                        }}
                      >
                        {day.getDate()}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px 10px', borderTop: '1px solid #f3f4f6',
          }}>
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#6b7280', fontWeight: 600,
                fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6,
              }}
            >
              Borrar
            </button>
            <button
              onClick={() => {
                onChange(todayWeekVal);
                setOpen(false);
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#00829a', fontWeight: 700,
                fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6,
              }}
            >
              Esta semana
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
