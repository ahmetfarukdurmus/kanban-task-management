import React, { useMemo } from 'react';
import { parseCascadingOptions, resolveCascadingValues } from '@/utils/cascadingUtils';

export interface CascadingSelectFieldProps {
  fieldName: string;
  fieldValue: string;
  options: string | null | undefined;
  placeholder?: string | null;
  required?: boolean;
  disabled?: boolean;
  onChange: (newValue: string) => void;
}

export default function CascadingSelectField({
  fieldName: _fieldName,
  fieldValue,
  options,
  placeholder,
  required = false,
  disabled = false,
  onChange,
}: CascadingSelectFieldProps) {
  const config = useMemo(() => parseCascadingOptions(options), [options]);
  const { parentVal, childVal } = useMemo(
    () => resolveCascadingValues(fieldValue, config),
    [fieldValue, config]
  );

  const availableChildren = useMemo(() => {
    if (!parentVal) return [];
    return config.childOptions[parentVal] || [];
  }, [parentVal, config]);

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParent = e.target.value;
    if (!newParent) {
      onChange('');
    } else {
      // When parent changes, reset child selection and pass new parent or empty child
      onChange(newParent);
    }
  };

  const handleChildChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChild = e.target.value;
    if (!newChild) {
      onChange(parentVal || '');
    } else {
      onChange(newChild);
    }
  };

  // If no parent options are configured yet in TaskType
  if (config.parentOptions.length === 0) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          value={fieldValue || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Değer giriniz...'}
          className="field w-full text-xs bg-white py-1.5"
          disabled={disabled}
          required={required}
        />
        <p className="text-[10px] text-amber-600">
          ⚠️ Bu alan için henüz bağlantılı dropdown seçenekleri tanımlanmamış.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* 1. Parent Select (Ana Port Grubu) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
              <span>{config.parentLabel || 'Ana Port Grubu'}</span>
            </span>
            {parentVal && (
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded">
                Seçildi: {parentVal}
              </span>
            )}
          </label>
          <select
            value={parentVal}
            onChange={handleParentChange}
            disabled={disabled}
            className={`field w-full text-xs font-semibold bg-white py-1.5 border transition-all ${
              required && !parentVal
                ? 'border-amber-400 focus:border-amber-500'
                : 'border-slate-200 focus:border-blue-500'
            }`}
            required={required}
          >
            <option value="">-- {placeholder || 'Ana Port Grubu Seçiniz'} --</option>
            {config.parentOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Child Select (Port Numarası) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  parentVal ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              />
              <span>{config.childLabel || 'Port Numarası'}</span>
            </span>
            {childVal && (
              <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.2 rounded">
                {childVal}
              </span>
            )}
          </label>
          <select
            value={childVal}
            onChange={handleChildChange}
            disabled={disabled || !parentVal || availableChildren.length === 0}
            className={`field w-full text-xs font-semibold py-1.5 border transition-all ${
              !parentVal
                ? 'bg-slate-100/90 text-slate-400 cursor-not-allowed border-dashed border-slate-300'
                : required && !childVal && availableChildren.length > 0
                ? 'bg-white border-amber-400 focus:border-amber-500 text-slate-800'
                : 'bg-white border-slate-200 focus:border-purple-500 text-slate-800'
            }`}
            required={required && availableChildren.length > 0}
          >
            <option value="">
              {!parentVal
                ? 'Önce grup seçin'
                : availableChildren.length === 0
                ? 'Alt seçenek bulunamadı'
                : `-- ${config.childLabel || 'Port Numarası'} Seçiniz --`}
            </option>
            {availableChildren.map((child) => (
              <option key={child} value={child}>
                {child}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Summary Pill */}
      {parentVal && (
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="font-semibold text-slate-700">Seçili Değer:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200/70">
              <span>{parentVal}</span>
              {childVal && (
                <>
                  <span className="text-blue-400">›</span>
                  <span className="text-purple-700">{childVal}</span>
                </>
              )}
            </span>
          </div>
          {childVal && (
            <button
              type="button"
              onClick={() => onChange(parentVal)}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline"
            >
              Alt Seçimi Temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
