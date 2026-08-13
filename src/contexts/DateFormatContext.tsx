import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { DateFormatType, formatDate, formatDateShort } from '@/lib/formatters';

interface DateFormatContextType {
  /** Preferred date format of the active profile */
  dateFormat: DateFormatType;
  /** Format a full date respecting the preference */
  fd: (date: string | Date) => string;
  /** Format a short (day/month) date respecting the preference */
  fdShort: (date: string | Date) => string;
  /** Format a date-time respecting the preference (date + HH:mm) */
  fdTime: (date: string | Date) => string;
  /** Update preference locally (after saving in Definições) */
  setDateFormat: (f: DateFormatType) => void;
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

export const useDateFormat = () => {
  const ctx = useContext(DateFormatContext);
  if (!ctx) throw new Error('useDateFormat must be used within DateFormatProvider');
  return ctx;
};

export const DateFormatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveProfile();
  const [dateFormat, setDateFormat] = useState<DateFormatType>('DD/MM/YYYY');

  useEffect(() => {
    if (!user || !activeUserId) return;
    supabase
      .from('profiles')
      .select('date_format')
      .eq('user_id', activeUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.date_format) setDateFormat(data.date_format as DateFormatType);
      });
  }, [user, activeUserId]);

  const fd = useCallback((date: string | Date) => formatDate(date, dateFormat), [dateFormat]);
  const fdShort = useCallback((date: string | Date) => formatDateShort(date, dateFormat), [dateFormat]);
  const fdTime = useCallback((date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${formatDate(d, dateFormat)} ${hh}:${mm}`;
  }, [dateFormat]);

  return (
    <DateFormatContext.Provider value={{ dateFormat, fd, fdShort, fdTime, setDateFormat }}>
      {children}
    </DateFormatContext.Provider>
  );
};
