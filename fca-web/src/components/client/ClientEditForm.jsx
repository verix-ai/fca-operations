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

  // Get active caregiver from linked caregivers (new) or fall back to legacy client fields
  const activeCaregiver = client.caregivers?.find(c => c.status === 'active');
  const caregiverName = activeCaregiver?.full_name || client.caregiver_name || '-';
  const caregiverRelationship = activeCaregiver?.relationship || client.caregiver_relationship || '-';
  const caregiverPhone = activeCaregiver?.phone || client.caregiver_phone || '-';
  const caregiverLivesInHome = activeCaregiver?.lives_in_home ?? client.caregiver_lives_in_home ?? false;

  const [formData, setFormData] = useState({
    client_name: client.client_name || '',
    program: client.program || '',
    caregiver_name: client.caregiver_name || '',
    client_phone: client.client_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[0] : ''),
    caregiver_phone: client.caregiver_phone || (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : ''),
    caregiver_relationship: client.caregiver_relationship || '',
    caregiver_lives_in_home: client.caregiver_lives_in_home || false,
    email: client.email || '',
    location: client.location || '',
    frequency: client.frequency || '',
    cost_share_amount: client.cost_share_amount || '',
    director_of_marketing: client.director_of_marketing || '',
    notes: client.notes || '',
    // Demographics
    sex: client.sex || '',
    date_of_birth: client.date_of_birth || '',
    medicaid_or_ssn: client.medicaid_or_ssn || '',
    // Address
    address_line1: client.address_line1 || '',
    address_line2: client.address_line2 || '',
    city: client.city || '',
    state: client.state || 'GA',
    zip: client.zip || '',
    // Medical
    physician: client.physician || '',
    diagnosis: client.diagnosis || '',
    // Services & Benefits
    receives_benefits: client.receives_benefits || '',
    benefits_pay_date: client.benefits_pay_date || '',
    // Referral source
    heard_about_us: client.heard_about_us || '',
    referral_date: client.referral_date || ''
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
      } catch { }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await Marketer.list();
        setMarketers(list.map(m => m.name));
      } catch { }
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
      } catch { }
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
            {/* Client Information */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Client Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Client Name</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.client_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Program</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.program || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Company</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.company || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Email</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Location</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.location || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Frequency</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.frequency || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Cost Share Amount</Label>
                  <p className="text-heading-primary font-medium mt-1">${client.cost_share_amount || '0.00'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Marketer</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.director_of_marketing || '-'}</p>
                </div>
              </div>
            </div>

            {/* Demographics */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Demographics</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Sex</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.sex || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Date of Birth</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.date_of_birth || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Medicaid/SSN</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.medicaid_or_ssn || '-'}</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Contact Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Client Phone</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.client_phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Caregiver Phone</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.caregiver_phone || '-'}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Address</h3>
              {(client.address_line1 || client.city) ? (
                <p className="text-heading-primary font-medium">
                  {client.address_line1 && <>{client.address_line1}<br /></>}
                  {client.address_line2 && <>{client.address_line2}<br /></>}
                  {(client.city || client.state || client.zip) && (
                    <>{client.city}, {client.state} {client.zip}</>
                  )}
                </p>
              ) : (
                <p className="text-heading-primary font-medium">-</p>
              )}
            </div>

            {/* Caregiver Details */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Caregiver Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Caregiver Name</Label>
                  <p className="text-heading-primary font-medium mt-1">{caregiverName}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Relationship</Label>
                  <p className="text-heading-primary font-medium mt-1">{caregiverRelationship}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Caregiver Phone</Label>
                  <p className="text-heading-primary font-medium mt-1">{caregiverPhone}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Lives in Home</Label>
                  <p className="text-heading-primary font-medium mt-1">{caregiverLivesInHome ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Medical Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Primary Physician</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.physician || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Diagnosis</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.diagnosis || '-'}</p>
                </div>
              </div>
            </div>

            {/* Benefits Information */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Benefits Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">Receives Benefits</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.receives_benefits || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Benefits Pay Date</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.benefits_pay_date || '-'}</p>
                </div>
              </div>
            </div>

            {/* Referral Information */}
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Referral Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-heading-subdued text-xs">How They Heard About Us</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.heard_about_us || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Referral Date</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.referral_date || '-'}</p>
                </div>
                <div>
                  <Label className="text-heading-subdued text-xs">Intake Date</Label>
                  <p className="text-heading-primary font-medium mt-1">{client.intake_date || '-'}</p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            {(client.additional_info || client.notes) && (
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-heading-primary font-semibold mb-4 text-sm uppercase tracking-wider">Additional Information</h3>
                {client.additional_info && (
                  <div className="mb-4">
                    <Label className="text-heading-subdued text-xs">From Referral</Label>
                    <p className="text-heading-primary font-medium mt-1 whitespace-pre-wrap">{client.additional_info}</p>
                  </div>
                )}
                {client.notes && (
                  <div>
                    <Label className="text-heading-subdued text-xs">Notes</Label>
                    <p className="text-heading-primary font-medium mt-1 whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </div>
            )}
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
              <Label htmlFor="director_of_marketing" className="text-heading-subdued font-medium">Marketer</Label>
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

            {/* Demographics Section */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Demographics</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="sex" className="text-heading-subdued font-medium">Sex</Label>
                  <Select value={formData.sex} onValueChange={(value) => handleInputChange('sex', value)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="date_of_birth" className="text-heading-subdued font-medium">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="medicaid_or_ssn" className="text-heading-subdued font-medium">Medicaid/SSN</Label>
                  <Input
                    id="medicaid_or_ssn"
                    value={formData.medicaid_or_ssn}
                    onChange={(e) => handleInputChange('medicaid_or_ssn', e.target.value)}
                    placeholder="Medicaid ID or SSN"
                    className="rounded-xl py-3"
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Address</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="address_line1" className="text-heading-subdued font-medium">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    value={formData.address_line1}
                    onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    placeholder="Street address"
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="address_line2" className="text-heading-subdued font-medium">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={formData.address_line2}
                    onChange={(e) => handleInputChange('address_line2', e.target.value)}
                    placeholder="Apt, unit, suite, etc."
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="city" className="text-heading-subdued font-medium">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="rounded-xl py-3"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="state" className="text-heading-subdued font-medium">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="GA"
                      className="rounded-xl py-3"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="zip" className="text-heading-subdued font-medium">ZIP</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => handleInputChange('zip', e.target.value)}
                      placeholder="30301"
                      className="rounded-xl py-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Caregiver Details */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Caregiver Details</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="caregiver_lives_in_home"
                    checked={formData.caregiver_lives_in_home}
                    onChange={(e) => handleInputChange('caregiver_lives_in_home', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="caregiver_lives_in_home" className="text-heading-subdued font-medium cursor-pointer">
                    Caregiver lives in home with client
                  </Label>
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Medical Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="physician" className="text-heading-subdued font-medium">Primary Physician</Label>
                  <Input
                    id="physician"
                    value={formData.physician}
                    onChange={(e) => handleInputChange('physician', e.target.value)}
                    placeholder="Dr. Smith"
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="diagnosis" className="text-heading-subdued font-medium">Diagnosis</Label>
                  <Input
                    id="diagnosis"
                    value={formData.diagnosis}
                    onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                    placeholder="Medical diagnosis"
                    className="rounded-xl py-3"
                  />
                </div>
              </div>
            </div>

            {/* Benefits Information */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Benefits Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="receives_benefits" className="text-heading-subdued font-medium">Receives Benefits?</Label>
                  <Select value={formData.receives_benefits} onValueChange={(value) => handleInputChange('receives_benefits', value)}>
                    <SelectTrigger className="rounded-xl py-3">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="benefits_pay_date" className="text-heading-subdued font-medium">Benefits Pay Date</Label>
                  <Input
                    id="benefits_pay_date"
                    value={formData.benefits_pay_date}
                    onChange={(e) => handleInputChange('benefits_pay_date', e.target.value)}
                    placeholder="e.g., 1st of month"
                    className="rounded-xl py-3"
                  />
                </div>
              </div>
            </div>

            {/* Referral Information */}
            <div className="col-span-2 border-t border-white/10 pt-6 mt-6">
              <h3 className="text-heading-primary font-semibold mb-4">Referral Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="heard_about_us" className="text-heading-subdued font-medium">How Did They Hear About Us?</Label>
                  <Input
                    id="heard_about_us"
                    value={formData.heard_about_us}
                    onChange={(e) => handleInputChange('heard_about_us', e.target.value)}
                    placeholder="Source"
                    className="rounded-xl py-3"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="referral_date" className="text-heading-subdued font-medium">Referral Date</Label>
                  <Input
                    id="referral_date"
                    type="date"
                    value={formData.referral_date}
                    onChange={(e) => handleInputChange('referral_date', e.target.value)}
                    className="rounded-xl py-3"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 col-span-2">
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
