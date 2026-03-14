import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export type PeriodPreset = 'YTD' | 'QTD' | 'STD' | 'MTD' | 'year' | 'custom';

export interface PeriodFilterState {
  preset: PeriodPreset;
  year: number;
  compareYear: number;
  customStart?: string;
  customEnd?: string;
}

interface PeriodFilterProps {
  value: PeriodFilterState;
  onChange: (v: PeriodFilterState) => void;
}

const YEARS = [2022, 2023, 2024, 2025, 2026];

export function getDateRange(state: PeriodFilterState): { start: string; end: string; prevStart: string; prevEnd: string } {
  const now = new Date();
  const y = state.year;
  const py = state.compareYear;
  const day = now.getDate();
  const month = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, '0');

  let start: string, end: string, prevStart: string, prevEnd: string;

  switch (state.preset) {
    case 'YTD':
      start = `${y}-01-01`;
      end = `${y}-${pad(month + 1)}-${pad(day)}`;
      prevStart = `${py}-01-01`;
      prevEnd = `${py}-${pad(month + 1)}-${pad(day)}`;
      break;
    case 'QTD': {
      const qStart = Math.floor(month / 3) * 3;
      start = `${y}-${pad(qStart + 1)}-01`;
      end = `${y}-${pad(month + 1)}-${pad(day)}`;
      prevStart = `${py}-${pad(qStart + 1)}-01`;
      prevEnd = `${py}-${pad(month + 1)}-${pad(day)}`;
      break;
    }
    case 'STD': {
      const sStart = month < 6 ? 0 : 6;
      start = `${y}-${pad(sStart + 1)}-01`;
      end = `${y}-${pad(month + 1)}-${pad(day)}`;
      prevStart = `${py}-${pad(sStart + 1)}-01`;
      prevEnd = `${py}-${pad(month + 1)}-${pad(day)}`;
      break;
    }
    case 'MTD':
      start = `${y}-${pad(month + 1)}-01`;
      end = `${y}-${pad(month + 1)}-${pad(day)}`;
      prevStart = `${py}-${pad(month + 1)}-01`;
      prevEnd = `${py}-${pad(month + 1)}-${pad(day)}`;
      break;
    case 'year':
      start = `${y}-01-01`;
      end = `${y}-12-31`;
      prevStart = `${py}-01-01`;
      prevEnd = `${py}-12-31`;
      break;
    case 'custom':
      start = state.customStart || `${y}-01-01`;
      end = state.customEnd || now.toISOString().split('T')[0];
      prevStart = `${py}-01-01`;
      prevEnd = `${py}-12-31`;
      break;
    default:
      start = `${y}-01-01`;
      end = `${y}-12-31`;
      prevStart = `${py}-01-01`;
      prevEnd = `${py}-12-31`;
  }

  return { start, end, prevStart, prevEnd };
}

const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange }) => {
  const set = (partial: Partial<PeriodFilterState>) => onChange({ ...value, ...partial });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Select value={value.preset} onValueChange={(v) => set({ preset: v as PeriodPreset })}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="YTD">YTD</SelectItem>
            <SelectItem value="QTD">QTD</SelectItem>
            <SelectItem value="STD">STD</SelectItem>
            <SelectItem value="MTD">MTD</SelectItem>
            <SelectItem value="year">Ano Completo</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Ano</Label>
        <Select value={String(value.year)} onValueChange={v => set({ year: Number(v) })}>
          <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">vs</Label>
        <Select value={String(value.compareYear)} onValueChange={v => set({ compareYear: Number(v) })}>
          <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {value.preset === 'custom' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" className="h-9 w-[140px]" value={value.customStart || ''} onChange={e => set({ customStart: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" className="h-9 w-[140px]" value={value.customEnd || ''} onChange={e => set({ customEnd: e.target.value })} />
          </div>
        </>
      )}
    </div>
  );
};

export default PeriodFilter;
