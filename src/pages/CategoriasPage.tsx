import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProfile } from '@/contexts/ActiveProfileContext';
import { fetchCategories } from '@/lib/queries';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, FolderTree, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacroGroup } from '@/lib/calculations';

const groupColors: Record<string, string> = {
  Rendimentos: 'bg-income-muted text-income border-0',
  Despesas: 'bg-expense-muted text-expense border-0',
  Investimentos: 'bg-investment-muted text-investment border-0',
};

const CategoriasPage: React.FC = () => {
  const { user } = useAuth();
  const { activeUserId, canWrite } = useActiveProfile();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [parentCatId, setParentCatId] = useState<string>('');
  const [txCounts, setTxCounts] = useState<Record<string, number>>({});

  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState<MacroGroup>('Despesas');
  const [subName, setSubName] = useState('');

  const loadCategories = async () => {
    if (!user) return;
    setLoading(true);
    const [data, countRows] = await Promise.all([
      fetchCategories(activeUserId),
      fetchAllRows((s) => s.from('transactions').select('category_id, subcategory_id').eq('user_id', activeUserId)),
    ]);
    setCategories(data || []);

    // Count transactions per category and subcategory
    const counts: Record<string, number> = {};
    countRows.forEach((t: any) => {
      if (t.category_id) counts[`cat_${t.category_id}`] = (counts[`cat_${t.category_id}`] || 0) + 1;
      if (t.subcategory_id) counts[`sub_${t.subcategory_id}`] = (counts[`sub_${t.subcategory_id}`] || 0) + 1;
    });
    setTxCounts(counts);
    setLoading(false);
  };

  useEffect(() => { loadCategories(); }, [user]);

  const handleSaveCategory = async () => {
    if (!user || !catName.trim()) return;
    try {
      if (editingCat) {
        await supabase.from('categories').update({ name: catName, group_type: catGroup }).eq('id', editingCat.id);
        toast.success('Categoria atualizada');
      } else {
        await supabase.from('categories').insert({ user_id: activeUserId, name: catName, group_type: catGroup });
        toast.success('Categoria criada');
      }
      setDialogOpen(false);
      setCatName('');
      setEditingCat(null);
      loadCategories();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveSubcategory = async () => {
    if (!user || !subName.trim() || !parentCatId) return;
    try {
      if (editingSub) {
        await supabase.from('subcategories').update({ name: subName, category_id: parentCatId }).eq('id', editingSub.id);
        toast.success('Subcategoria atualizada');
      } else {
        await supabase.from('subcategories').insert({ category_id: parentCatId, user_id: activeUserId, name: subName });
        toast.success('Subcategoria criada');
      }
      setSubDialogOpen(false);
      setSubName('');
      setEditingSub(null);
      loadCategories();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleCategoryActive = async (cat: any) => {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    loadCategories();
  };

  const handleDeleteCategory = async (cat: any) => {
    const count = txCounts[`cat_${cat.id}`] || 0;
    const msg = count > 0
      ? `Esta categoria tem ${count} transações associadas. As transações ficarão sem categoria. Eliminar?`
      : 'Eliminar esta categoria e todas as suas subcategorias?';
    if (!confirm(msg)) return;

    // Nullify transactions referencing this category
    if (count > 0) {
      await supabase.from('transactions').update({ category_id: null, subcategory_id: null }).eq('category_id', cat.id);
    }
    // Delete subcategories first, then category
    await supabase.from('subcategories').delete().eq('category_id', cat.id);
    await supabase.from('categories').delete().eq('id', cat.id);
    toast.success('Categoria eliminada');
    loadCategories();
  };

  const handleDeleteSubcategory = async (sub: any) => {
    const count = txCounts[`sub_${sub.id}`] || 0;
    const msg = count > 0
      ? `Esta subcategoria tem ${count} transações. As transações ficarão sem subcategoria. Eliminar?`
      : 'Eliminar esta subcategoria?';
    if (!confirm(msg)) return;

    if (count > 0) {
      await supabase.from('transactions').update({ subcategory_id: null }).eq('subcategory_id', sub.id);
    }
    await supabase.from('subcategories').delete().eq('id', sub.id);
    toast.success('Subcategoria eliminada');
    loadCategories();
  };

  const grouped = {
    Rendimentos: categories.filter(c => c.group_type === 'Rendimentos'),
    Despesas: categories.filter(c => c.group_type === 'Despesas'),
    Investimentos: categories.filter(c => c.group_type === 'Investimentos'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categorias</p>
        </div>
        <Button onClick={() => { setEditingCat(null); setCatName(''); setCatGroup('Despesas'); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {(['Rendimentos', 'Despesas', 'Investimentos'] as const).map(group => (
        <Card key={group} className="glass-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge className={cn('text-xs', groupColors[group])}>{group}</Badge>
              <span className="text-muted-foreground text-sm">({grouped[group].length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[group].map(cat => {
              const catCount = txCounts[`cat_${cat.id}`] || 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span className={cn('text-sm font-medium', !cat.is_active && 'line-through text-muted-foreground')}>{cat.name}</span>
                      <span className="text-xs text-muted-foreground">({cat.subcategories?.length || 0} sub · {catCount} mov)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={cat.is_active} onCheckedChange={() => toggleCategoryActive(cat)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingCat(cat); setCatName(cat.name); setCatGroup(cat.group_type); setDialogOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCategory(cat)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setParentCatId(cat.id); setEditingSub(null); setSubName(''); setSubDialogOpen(true);
                      }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {cat.subcategories?.map((sub: any) => {
                    const subCount = txCounts[`sub_${sub.id}`] || 0;
                    return (
                      <div key={sub.id} className="ml-8 flex items-center justify-between rounded-md p-1.5 hover:bg-muted/30">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{sub.name}</span>
                          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', subCount === 0 && 'bg-warning-muted text-warning')}>
                            {subCount}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditingSub(sub); setSubName(sub.name); setParentCatId(cat.id); setSubDialogOpen(true);
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteSubcategory(sub)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {grouped[group].length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem categorias</p>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={catGroup} onValueChange={v => setCatGroup(v as MacroGroup)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rendimentos">Rendimentos</SelectItem>
                  <SelectItem value="Despesas">Despesas</SelectItem>
                  <SelectItem value="Investimentos">Investimentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveCategory} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Editar Subcategoria' : 'Nova Subcategoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={subName} onChange={e => setSubName(e.target.value)} />
            </div>
            {editingSub && (
              <div className="space-y-2">
                <Label>Categoria (mover)</Label>
                <Select value={parentCatId} onValueChange={setParentCatId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.group_type})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleSaveSubcategory} className="w-full">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriasPage;
