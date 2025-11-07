import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, Plus, Minus, Edit } from "lucide-react";
import { useToast } from "@/components/ui/toast.jsx";
import { formatPhone } from "@/utils";
import Program from "@/entities/Program.supabase";
import Marketer from "@/entities/Marketer.supabase";
import SettingsStore from "@/entities/Settings.supabase";

const PROGRAMS = ["PSS", "PCA", "Companion Care", "Respite Care"];

export default function ClientEditForm({ client, onUpdate }) {
  const { push } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    client_name: client.client_name || '',
    program: client.program || '',
    caregiver_name: client.caregiver_name || '',
    client_phone: client.client_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[0] : ''),
    caregiver_phone: client.caregiver_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : ''),
    caregiver_relationship: client.caregiver_relationship || '',
    email: client.email || '',
    location: client.location || '',
    frequency: client.frequency || '',
    cost_share_amount: client.cost_share_amount || '',
    director_of_marketing: client.director_of_marketing || '',
    notes: client.notes || ''
  });

  // Frequency split state (hours/day and days/week)
  const [freqHours, setFreqHours] = useState('');
  const [freqDays, setFreqDays] = useState('');
  const [programs, setPrograms] = useState([]);
  const [countyOptions, setCountyOptions] = useState([]);
  const [marketers, setMarketers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await Program.list();
        setPrograms(list.map(p => p.name));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await Marketer.list();
        setMarketers(list.map(m => m.name));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const all = await SettingsStore.get();
        const regions = all?.regions || {};
        const options = Object.entries(regions).flatMap(([state, counties]) =>
          (counties || []).map((c) => `${c}, ${state}`)
        );
        setCountyOptions(options);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // Parse existing frequency like "7hrs/7days"
    const match = /^(\d+)\s*hrs?\/(\d+)\s*days?$/i.exec(client.frequency || '');
    if (match) {
      setFreqHours(match[1]);
      setFreqDays(match[2]);
    }
  }, [client.frequency]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateFrequency = (hours, days) => {
    const h = hours ?? freqHours;
    const d = days ?? freqDays;
    if (hours !== undefined) setFreqHours(hours);
    if (days !== undefined) setFreqDays(days);
    const value = h && d ? `${h}hrs/${d}days` : '';
    handleInputChange('frequency', value);
  };

  const handlePhoneChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // removed legacy multi-phone add/remove in favor of explicit client/caregiver phone fields

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanedData = {
        ...formData,
        phone_numbers: [formData.client_phone, formData.caregiver_phone].filter(ph => (ph || '').trim() !== ''),
        cost_share_amount: formData.cost_share_amount ? parseFloat(formData.cost_share_amount) : 0
      };
      await onUpdate(cleanedData);
      setIsEditing(false);
      push({ title: 'Client changes saved' });
    } catch (error) {
      console.error("Error updating client:", error);
      push({ title: 'Failed to save changes', description: String(error?.message || error), variant: 'destructive', duration: 6000 });
    }
    setIsSaving(false);
  };

  return (
    <Card className="bg-hero-card backdrop-blur-sm border border-[rgba(147,165,197,0.2)] shadow-card rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-heading-primary text-xl flex items-center gap-3">
          <Edit className="w-5 h-5" />
          Edit Client Details
        </CardTitle>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            variant="default"
            size="sm"
            borderRadius="999px"
            className="gap-2 px-5"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {!isEditing ? (
          <div className="space-y-6 text-heading-subdued">
            <p className="text-heading-subdued">Click "Edit" to modify client information.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-heading-subdued">Client Name</Label>
                <p className="text-heading-primary font-medium mt-1">{client.client_name}</p>
              </div>
              <div>
                <Label className="text-heading-subdued">Program</Label>
                <p className="text-heading-primary font-medium mt-1">{client.program}</p>
              </div>
              <div>
                <Label className="text-heading-subdued">Caregiver Name</Label>
                <p className="text-heading-primary font-medium mt-1">{client.caregiver_name}</p>
              </div>
              <div>
                <Label className="text-heading-subdued">Relationship</Label>
                <p className="text-heading-primary font-medium mt-1">{client.caregiver_relationship || '-'}</p>
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-6">
            {/* Client Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="client_name" className="text-heading-subdued font-medium">Client Name</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => handleInputChange('client_name', e.target.value)}
                  className="rounded-xl py-3"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="program" className="text-heading-subdued font-medium">Program</Label>
                <Select value={formData.program} onValueChange={(value) => handleInputChange('program', value)}>
                  <SelectTrigger className="rounded-xl py-3">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program} value={program}>
                        {program}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="caregiver_name" className="text-heading-subdued font-medium">Caregiver Name</Label>
                <Input
                  id="caregiver_name"
                  value={formData.caregiver_name}
                  onChange={(e) => handleInputChange('caregiver_name', e.target.value)}
                  className="rounded-xl py-3"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="caregiver_relationship" className="text-heading-subdued font-medium">Caregiver Relationship</Label>
                <Input
                  id="caregiver_relationship"
                  value={formData.caregiver_relationship}
                  onChange={(e) => handleInputChange('caregiver_relationship', e.target.value)}
                  placeholder="e.g., Son, Daughter, Spouse"
                  className="rounded-xl py-3"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="email" className="text-heading-subdued font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="rounded-xl py-3"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="location" className="text-heading-subdued font-medium">Location</Label>
                {countyOptions.length > 0 ? (
                  <Select value={formData.location} onValueChange={(v) => handleInputChange('location', v)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      {countyOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Enter county (configure in Settings)"
                    className="rounded-xl py-3"
                  />
                )}
              </div>
            </div>

            {/* Phone Numbers */}
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-heading-subdued font-medium">Client Phone</Label>
                  <Input
                    value={formData.client_phone}
                    onChange={(e) => handlePhoneChange('client_phone', formatPhone(e.target.value))}
                    placeholder="e.g., 478-390-7749"
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-heading-subdued font-medium">Caregiver Phone</Label>
                  <Input
                    value={formData.caregiver_phone}
                    onChange={(e) => handlePhoneChange('caregiver_phone', formatPhone(e.target.value))}
                    placeholder="e.g., 478-390-7749"
                    className="rounded-xl py-3"
                  />
                </div>
              </div>
            </div>

            {/* Additional Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-heading-subdued font-medium">Frequency</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={freqHours} onValueChange={(v) => updateFrequency(v, undefined)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Hrs/day" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => String(i + 1)).map((h) => (
                        <SelectItem key={h} value={h}>{h} hrs</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={freqDays} onValueChange={(v) => updateFrequency(undefined, v)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Days/week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 7 }, (_, i) => String(i + 1)).map((d) => (
                        <SelectItem key={d} value={d}>{d} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-heading-subdued">Selected: {formData.frequency || '—'}</div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="cost_share_amount" className="text-heading-subdued font-medium">Cost Share Amount</Label>
                <Input
                  id="cost_share_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_share_amount}
                  onChange={(e) => handleInputChange('cost_share_amount', e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl py-3"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="director_of_marketing" className="text-heading-subdued font-medium">Director of Marketing</Label>
              {marketers.length > 0 ? (
                <Select value={formData.director_of_marketing} onValueChange={(v) => handleInputChange('director_of_marketing', v)}>
                  <SelectTrigger className="rounded-xl py-3">
                    <SelectValue placeholder="Select marketer" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketers.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="director_of_marketing"
                  value={formData.director_of_marketing}
                  onChange={(e) => handleInputChange('director_of_marketing', e.target.value)}
                  placeholder="Enter marketer (configure in Settings)"
                  className="rounded-xl py-3"
                />
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="notes" className="text-heading-subdued font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes..."
                className="rounded-xl py-3 h-32"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                borderRadius="1rem"
                onClick={() => setIsEditing(false)}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                variant="default"
                borderRadius="1rem"
                className="gap-2 px-6"
              >
                {isSaving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
