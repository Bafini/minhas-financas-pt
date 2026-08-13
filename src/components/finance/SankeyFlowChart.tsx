import React, { useMemo, useState } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatCurrency } from '@/lib/formatters';
import { buildSankeyData, SankeyDetail, SankeyNameMaps, SankeyTxn } from '@/lib/calculations';

interface Props {
  transactions: SankeyTxn[];
  maps: SankeyNameMaps;
}

const KIND_COLOR: Record<string, string> = {
  income: 'hsl(var(--income))',
  expense: 'hsl(var(--expense))',
  investment: 'hsl(var(--investment))',
  savings: 'hsl(var(--income))',
  hub: 'hsl(var(--foreground))',
};

const SankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isRight = x + width + 6 > containerWidth - 120;
  const color = KIND_COLOR[payload?.kind] ?? 'hsl(var(--muted-foreground))';
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} radius={[2, 2, 2, 2]} />
      <text
        textAnchor={isRight ? 'end' : 'start'}
        x={isRight ? x - 6 : x + width + 6}
        y={y + height / 2}
        dominantBaseline="middle"
        fontSize={11}
        fill="hsl(var(--foreground))"
      >
        {payload?.name}
      </text>
    </Layer>
  );
};

const SankeyLink = (props: any) => {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload } = props;
  const kind = payload?.target?.kind ?? payload?.source?.kind;
  const color = KIND_COLOR[kind] ?? 'hsl(var(--muted-foreground))';
  return (
    <path
      key={`link-${index}`}
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      stroke={color}
      strokeWidth={Math.max(1, linkWidth)}
      strokeOpacity={0.28}
      fill="none"
    />
  );
};

const SankeyFlowChart: React.FC<Props> = ({ transactions, maps }) => {
  const [detail, setDetail] = useState<SankeyDetail>('category');
  const data = useMemo(() => buildSankeyData(transactions, maps, detail), [transactions, maps, detail]);

  const height = Math.max(340, Math.min(760, data.nodes.length * 34));

  return (
    <Card className="glass-surface">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base font-medium">Fluxo Financeiro</CardTitle>
          <p className="text-xs text-muted-foreground">Para onde vai o dinheiro no período selecionado</p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={detail}
          onValueChange={(v) => v && setDetail(v as SankeyDetail)}
        >
          <ToggleGroupItem value="category" className="text-xs">Categorias</ToggleGroupItem>
          <ToggleGroupItem value="subcategory" className="text-xs">Subcategorias</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {data.links.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            Sem rendimentos no período para desenhar o fluxo.
          </div>
        ) : (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={data}
                nodePadding={16}
                nodeWidth={12}
                margin={{ top: 12, right: 140, bottom: 12, left: 140 }}
                node={<SankeyNode />}
                link={<SankeyLink />}
              >
                <Tooltip
                  formatter={(value: number) => [
                    `${formatCurrency(value)} · ${((value / data.totalIncome) * 100).toFixed(1)}% dos rendimentos`,
                    'Fluxo',
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SankeyFlowChart;
