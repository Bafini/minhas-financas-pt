import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'currency' | 'percentage' | 'number';
  icon?: LucideIcon;
  variant?: 'income' | 'expense' | 'investment' | 'neutral';
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  previousValue,
  format = 'currency',
  icon: Icon,
  variant = 'neutral',
}) => {
  const delta = previousValue !== undefined ? value - previousValue : undefined;
  const deltaPercentage = previousValue && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : undefined;

  const formattedValue = format === 'currency'
    ? formatCurrency(value)
    : format === 'percentage'
    ? `${value.toFixed(1)}%`
    : value.toLocaleString('pt-PT');

  const variantColors = {
    income: 'text-income',
    expense: 'text-expense',
    investment: 'text-investment',
    neutral: 'text-foreground',
  };

  return (
    <Card className="glass-surface animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={cn('h-4 w-4', variantColors[variant])} />}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold financial-value', variantColors[variant])}>
          {formattedValue}
        </div>
        {delta !== undefined && deltaPercentage !== undefined && (
          <p className="mt-1 flex items-center text-xs text-muted-foreground">
            {delta > 0 ? (
              <TrendingUp className="mr-1 h-3 w-3 text-income" />
            ) : delta < 0 ? (
              <TrendingDown className="mr-1 h-3 w-3 text-expense" />
            ) : (
              <Minus className="mr-1 h-3 w-3" />
            )}
            <span className={cn(
              'font-medium',
              delta > 0 ? 'text-income' : delta < 0 ? 'text-expense' : ''
            )}>
              {formatPercentage(deltaPercentage)}
            </span>
            <span className="ml-1">vs período homólogo</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default KPICard;
