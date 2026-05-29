'use client';
import { useState } from 'react';
import {
  formatNPWP, formatNPWPCompany, formatNIK,
  formatDateDMY, dmyToISO, isoToDMY,
} from '@/lib/formatters';

const BASE =
  'w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';

function Label({ text, htmlFor }: { text: string; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
    >
      {text}
    </label>
  );
}

export function NpwpInput({
  name, defaultValue = '', required, label, onChange,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  label: string;
  /** Optional callback for parent forms that need to react to the value
   *  (e.g. derive `punya_npwp` from non-empty input). */
  onChange?: (val: string) => void;
}) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input
        id={name}
        type="text"
        inputMode="numeric"
        name={name}
        value={val}
        required={required}
        placeholder="00.000.000.0-000.000"
        onChange={(e) => {
          const next = formatNPWP(e.target.value);
          setVal(next);
          onChange?.(next);
        }}
        className={`${BASE} font-mono`}
      />
    </div>
  );
}

export function NpwpCompanyInput({
  name, defaultValue = '', required, label,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  label: string;
}) {
  const [val, setVal] = useState(defaultValue);
  const digits = val.replace(/\D/g, '').length;
  const isValid = digits === 15 || digits === 16;
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input
        id={name}
        type="text"
        inputMode="numeric"
        name={name}
        value={val}
        required={required}
        placeholder="00.000.000.0-000.000"
        onChange={(e) => setVal(formatNPWPCompany(e.target.value))}
        className={`${BASE} font-mono`}
      />
      {digits > 0 && (
        <p
          className={`text-[11px] mt-1 font-medium ${
            isValid ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          {isValid ? `✓ ${digits} digit valid` : `${digits}/15-16 digit`}
        </p>
      )}
    </div>
  );
}

export function NikInput({
  name, defaultValue = '', required, label,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  label: string;
}) {
  const [val, setVal] = useState(defaultValue);
  const isKTP = /^\d{16}$/.test(val);
  const isPassport = /[A-Z]/.test(val) && val.length >= 5;
  const len = val.length;
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input
        id={name}
        type="text"
        inputMode="text"
        name={name}
        value={val}
        required={required}
        placeholder="16 digit KTP / Paspor TKA"
        onChange={(e) => setVal(formatNIK(e.target.value))}
        className={`${BASE} font-mono`}
      />
      <p
        className={`text-[11px] mt-1 font-medium ${
          isKTP || isPassport
            ? 'text-emerald-700'
            : len > 0
            ? 'text-amber-700'
            : 'text-[var(--text-muted)]'
        }`}
      >
        {isKTP
          ? '✓ KTP — 16 digit'
          : isPassport
          ? `✓ Paspor TKA — ${len} karakter`
          : len > 0
          ? `${len} karakter — KTP butuh 16 digit, paspor min. 5`
          : 'KTP (16 digit) atau paspor TKA (alfanumerik)'}
      </p>
    </div>
  );
}

export function NominalInput({
  name, defaultValue = 0, label, required, onChange,
}: {
  name: string;
  defaultValue?: number;
  label: string;
  required?: boolean;
  onChange?: (val: number) => void;
}) {
  const [display, setDisplay] = useState(
    defaultValue ? defaultValue.toLocaleString('id-ID') : '',
  );
  const [raw, setRaw] = useState(String(defaultValue || 0));
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input type="hidden" name={name} value={raw} />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[13px] font-medium font-mono pointer-events-none">
          Rp
        </span>
        <input
          id={name}
          type="text"
          inputMode="numeric"
          value={display}
          required={required}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            const fmt = digits ? parseInt(digits, 10).toLocaleString('id-ID') : '';
            setDisplay(fmt);
            setRaw(digits || '0');
            onChange?.(digits ? parseInt(digits, 10) : 0);
          }}
          className={`${BASE} pl-9 text-[15px] font-mono font-semibold`}
        />
      </div>
    </div>
  );
}

export function DateInput({
  name, defaultValue = '', label, required,
}: {
  name: string;
  defaultValue?: string;
  label: string;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(isoToDMY(defaultValue));
  const [iso, setIso] = useState(defaultValue);
  const digits = display.replace(/\D/g, '');
  const isValid = digits.length === 8;
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input type="hidden" name={name} value={iso} />
      <input
        id={name}
        type="text"
        inputMode="numeric"
        value={display}
        required={required}
        placeholder="dd/mm/yyyy"
        onChange={(e) => {
          const fmt = formatDateDMY(e.target.value);
          setDisplay(fmt);
          setIso(dmyToISO(fmt));
        }}
        className={`${BASE} font-mono`}
      />
      {display && (
        <p
          className={`text-[11px] mt-1 font-medium ${
            isValid ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          {isValid ? `✓ ${display}` : 'Format: dd/mm/yyyy'}
        </p>
      )}
    </div>
  );
}
