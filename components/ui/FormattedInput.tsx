'use client';
import { useState } from 'react';
import {
  formatNPWP, formatNPWPCompany, formatNIK,
  formatNominalDisplay, parseNominalToString,
  formatDateDMY, dmyToISO, isoToDMY,
} from '@/lib/formatters';

const BASE = "w-full px-3 py-3 bg-[#0D0D0F] border rounded-lg text-base text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono";

function useFocus() {
  const [f, setF] = useState(false);
  return {
    style: { borderColor: f ? 'rgba(37,99,235,0.4)' : '#1A1A1C' },
    onFocus: () => setF(true),
    onBlur:  () => setF(false),
  };
}

function Label({ text }: { text: string }) {
  return <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{text}</label>;
}

export function NpwpInput({ name, defaultValue = '', required, label }:
  { name: string; defaultValue?: string; required?: boolean; label: string }) {
  const [val, setVal] = useState(defaultValue);
  const f = useFocus();
  return (
    <div>
      <Label text={label} />
      <input type="text" inputMode="numeric" name={name} value={val} required={required}
        placeholder="00.000.000.0-000.000"
        onChange={e => setVal(formatNPWP(e.target.value))}
        className={BASE} {...f} />
    </div>
  );
}

export function NpwpCompanyInput({ name, defaultValue = '', required, label }:
  { name: string; defaultValue?: string; required?: boolean; label: string }) {
  const [val, setVal] = useState(defaultValue);
  const f = useFocus();
  return (
    <div>
      <Label text={label} />
      <input type="text" inputMode="numeric" name={name} value={val} required={required}
        placeholder="00.000.000.0-000.000.0"
        onChange={e => setVal(formatNPWPCompany(e.target.value))}
        className={BASE} {...f} />
      <p className="text-[10px] mt-1 text-zinc-700 font-mono">
        {val.replace(/\D/g,'').length}/16 digit
      </p>
    </div>
  );
}

export function NikInput({ name, defaultValue = '', required, label }:
  { name: string; defaultValue?: string; required?: boolean; label: string }) {
  const [val, setVal] = useState(defaultValue);
  const f = useFocus();
  const len = val.length;
  return (
    <div>
      <Label text={label} />
      <input type="text" inputMode="numeric" name={name} value={val} required={required}
        placeholder="0000000000000000"
        onChange={e => setVal(formatNIK(e.target.value))}
        className={BASE} {...f} />
      <p className={`text-[10px] mt-1 font-mono transition-colors ${
        len === 16 ? 'text-green-500' : len > 0 ? 'text-amber-500' : 'text-zinc-800'
      }`}>
        {len === 16 ? '✓ 16 digit valid' : len > 0 ? `${16 - len} digit lagi` : '16 digit diperlukan'}
      </p>
    </div>
  );
}

export function NominalInput({ name, defaultValue = 0, label, required }:
  { name: string; defaultValue?: number; label: string; required?: boolean }) {
  const [display, setDisplay] = useState(defaultValue ? defaultValue.toLocaleString('id-ID') : '');
  const [raw, setRaw]         = useState(String(defaultValue || 0));
  const f = useFocus();
  return (
    <div>
      <Label text={label} />
      <input type="hidden" name={name} value={raw} />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm font-mono">Rp</span>
        <input type="text" inputMode="numeric" value={display} required={required}
          placeholder="0"
          onChange={e => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            const fmt = digits ? parseInt(digits, 10).toLocaleString('id-ID') : '';
            setDisplay(fmt);
            setRaw(digits || '0');
          }}
          className={`${BASE} pl-9 text-lg font-bold`} {...f} />
      </div>
    </div>
  );
}

export function DateInput({ name, defaultValue = '', label, required }:
  { name: string; defaultValue?: string; label: string; required?: boolean }) {
  const [display, setDisplay] = useState(isoToDMY(defaultValue));
  const [iso, setIso]         = useState(defaultValue);
  const f = useFocus();
  const digits = display.replace(/\D/g, '');
  const isValid = digits.length === 8;
  return (
    <div>
      <Label text={label} />
      <input type="hidden" name={name} value={iso} />
      <input type="text" inputMode="numeric" value={display} required={required}
        placeholder="dd/mm/yyyy"
        onChange={e => {
          const fmt = formatDateDMY(e.target.value);
          setDisplay(fmt);
          setIso(dmyToISO(fmt));
        }}
        className={BASE} {...f} />
      {display && (
        <p className={`text-[10px] mt-1 font-mono ${isValid ? 'text-green-500' : 'text-amber-500'}`}>
          {isValid ? `✓ ${display}` : 'Format: dd/mm/yyyy'}
        </p>
      )}
    </div>
  );
}
