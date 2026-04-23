'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Loader2, GripVertical, ShoppingBag, Pencil, Check, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'

type CatalogItem = {
  id: string
  property_id: string
  name: string
  emoji: string
  default_price: number
  sort_order: number
  created_at: string
}

interface Props {
  propertyId: string
  catalog: CatalogItem[]
}

const EMOJI_OPTIONS = ['🍳','🛁','🔒','🗺️','✈️','🍽️','🚿','🧴','☕','🍺','🥗','🧺','🎒','🔑','🚗','🏊','🎾','📶','🛒','➕']

export function ExtraCatalogClient({ propertyId, catalog: initial }: Props) {
  const [items, setItems] = useState<CatalogItem[]>(initial)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', emoji: '➕', default_price: '' })
  const [editForm, setEditForm] = useState({ name: '', emoji: '➕', default_price: '' })

  async function handleAdd() {
    if (!form.name || !form.default_price) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('extra_catalog')
        .insert({
          property_id: propertyId,
          name: form.name.trim(),
          emoji: form.emoji,
          default_price: parseFloat(form.default_price),
          sort_order: items.length,
        })
        .select()
        .single()
      if (error) throw error
      setItems((prev) => [...prev, data])
      setForm({ name: '', emoji: '➕', default_price: '' })
      setShowForm(false)
      toast.success('Supplément ajouté au catalogue')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(item: CatalogItem) {
    setEditingId(item.id)
    setEditForm({ name: item.name, emoji: item.emoji, default_price: String(item.default_price) })
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name || !editForm.default_price) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('extra_catalog')
        .update({
          name: editForm.name.trim(),
          emoji: editForm.emoji,
          default_price: parseFloat(editForm.default_price),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      setItems((prev) => prev.map((i) => i.id === id ? data : i))
      setEditingId(null)
      toast.success('Supplément mis à jour')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('extra_catalog').delete().eq('id', id)
      if (error) throw error
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast.success('Supplément supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto hp-page-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0A1F1C]">Catalogue des suppléments</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            Créez vos propres suppléments avec vos tarifs. Ils apparaîtront comme boutons rapides lors de l&apos;ajout d&apos;extras.
          </p>
        </div>
        {!showForm && (
          <Button
            size="sm"
            className="bg-[#0F6E56] hover:bg-[#0c5a46] gap-1"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="bg-white border border-[#0F6E56]/20 rounded-[16px] shadow-[0_2px_8px_rgba(15,110,86,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0A1F1C]">Nouveau supplément</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#94A3B8]">Icône</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, emoji: e }))}
                    className={`w-9 h-9 rounded-[8px] text-lg flex items-center justify-center border transition-all ${
                      form.emoji === e
                        ? 'border-[#0F6E56] bg-[#0F6E56]/10 ring-1 ring-[#0F6E56]'
                        : 'border-[#E8ECF0] bg-white hover:border-[#0F6E56]/40'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#94A3B8]">Nom *</Label>
                <Input
                  placeholder="ex: Petit-déjeuner"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="h-9 text-sm border-[#E8ECF0] rounded-[10px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#94A3B8]">Prix par défaut (MAD) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.default_price}
                  onChange={(e) => setForm((p) => ({ ...p, default_price: e.target.value }))}
                  className="h-9 text-sm border-[#E8ECF0] rounded-[10px]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-[#0F6E56] hover:bg-[#0c5a46]"
                onClick={handleAdd}
                disabled={loading || !form.name || !form.default_price}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                Ajouter au catalogue
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[#E8ECF0]"
                onClick={() => { setShowForm(false); setForm({ name: '', emoji: '➕', default_price: '' }) }}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catalog list */}
      {items.length === 0 ? (
        <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
          <EmptyState
            icon={ShoppingBag}
            iconBg="bg-[#0F6E56]/10"
            iconColor="text-[#0F6E56]"
            title="Aucun supplément dans votre catalogue"
            description="Ajoutez vos suppléments (petit-déjeuner, navette, serviette…) avec vos propres tarifs."
          />
        </div>
      ) : (
        <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <CardContent className="p-0">
            <div className="divide-y divide-[#F0F4F7]">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <GripVertical className="w-4 h-4 text-[#C0CBD7] flex-shrink-0" />

                  {editingId === item.id ? (
                    /* Inline edit row */
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <div className="flex gap-1.5 flex-wrap">
                        {EMOJI_OPTIONS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setEditForm((p) => ({ ...p, emoji: e }))}
                            className={`w-8 h-8 rounded-[6px] text-base flex items-center justify-center border transition-all ${
                              editForm.emoji === e
                                ? 'border-[#0F6E56] bg-[#0F6E56]/10'
                                : 'border-[#E8ECF0] bg-white hover:border-[#0F6E56]/40'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="h-8 text-sm w-36 border-[#E8ECF0] rounded-[8px]"
                          placeholder="Nom"
                        />
                        <Input
                          type="number"
                          value={editForm.default_price}
                          onChange={(e) => setEditForm((p) => ({ ...p, default_price: e.target.value }))}
                          className="h-8 text-sm w-24 border-[#E8ECF0] rounded-[8px]"
                          placeholder="Prix"
                        />
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={loading}
                          className="w-8 h-8 rounded-[8px] bg-[#0F6E56] text-white flex items-center justify-center hover:bg-[#0c5a46] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="w-8 h-8 rounded-[8px] border border-[#E8ECF0] flex items-center justify-center hover:bg-[#F8FAFC] transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-[#94A3B8]" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <>
                      <span className="text-xl w-8 text-center flex-shrink-0">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0A1F1C] truncate">{item.name}</p>
                        <p className="text-xs text-[#94A3B8]">{formatCurrency(item.default_price)} / unité</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="w-7 h-7 rounded-[6px] border border-[#E8ECF0] flex items-center justify-center hover:border-[#0F6E56]/40 hover:text-[#0F6E56] transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                          className="w-7 h-7 rounded-[6px] border border-[#E8ECF0] flex items-center justify-center hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <p className="text-xs text-[#C0CBD7] text-center">
          {items.length} supplément{items.length > 1 ? 's' : ''} dans votre catalogue
        </p>
      )}
    </div>
  )
}
