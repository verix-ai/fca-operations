import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirm } from "@/components/ui";
import { useToast } from "@/components/ui/toast.jsx";
import { Heart, Phone, Mail, Home, MapPin, User as UserIcon, Calendar, AlertTriangle, Pencil, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isBefore, addDays, addYears } from "date-fns";
import { ClientCaregiver } from "@/entities/ClientCaregiver.supabase";
import { CAREGIVER_RELATIONSHIPS } from "../../constants/caregiver.js";
import { formatPhone } from "@/utils";
import { Notification } from "@/entities/Notification.supabase";
import { User } from "@/entities/User.supabase";
import { Marketer } from "@/entities/Marketer.supabase";
import ProfileImageUpload from "@/components/ui/ProfileImageUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SettingsStore from '@/entities/Settings.supabase';
import { PHASES } from "./PhaseProgress";

const InfoRow = ({ icon: Icon, label, value, status, onEdit }) => {
  if (!value) return null;
  // Status: 'ok' | 'warning' | 'error'
  let borderColor = 'border-white/5';
  let bgColor = 'bg-black/10';
  let iconColor = 'text-brand/70';
  let labelColor = 'text-heading-subdued';
  let valueColor = '';

  if (status === 'warning') {
    borderColor = 'border-amber-500/30';
    bgColor = 'bg-amber-500/10';
    iconColor = 'text-amber-500';
    labelColor = 'text-amber-200';
    valueColor = 'text-amber-100';
  } else if (status === 'error') {
    borderColor = 'border-red-500/30';
    bgColor = 'bg-red-500/10';
    iconColor = 'text-red-500';
    labelColor = 'text-red-200';
    valueColor = 'text-red-100';
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${borderColor} ${bgColor}`}>
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <div className={`text-xs uppercase tracking-[0.3em] ${labelColor}`}>{label}</div>
      <div className={`text-heading-primary text-sm font-medium truncate ml-auto ${valueColor}`}>{value}</div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="ml-2 bg-black/20 hover:bg-black/40 p-1.5 rounded-lg text-heading-subdued hover:text-heading-primary transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const defaultCaregiverForm = {
  full_name: "",
  relationship: "",
  phone: "",
  email: "",
  lives_in_home: false,
  notes: "",
};

const formatRange = (start, end) => {
  if (!start && !end) return "Dates not provided";
  const startLabel = start ? format(new Date(start), "MMM d, yyyy") : "Unknown start";
  const endLabel = end ? format(new Date(end), "MMM d, yyyy") : "Present";
  return `${startLabel} – ${endLabel}`;
};

const formatDate = (dateString) => {
  if (!dateString) return null;
  return format(new Date(dateString), "MMM d, yyyy");
};

export default function CaregiverProfile({
  client,
  caregivers = [],
  onUpdate,
  onRefresh,
  readOnly = false,
}) {
  const { push } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(defaultCaregiverForm);
  const [errors, setErrors] = useState({});
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");

  const sortedCaregivers = useMemo(() => {
    if (!Array.isArray(caregivers)) return [];
    return [...caregivers].sort((a, b) => {
      const aDate = a.started_at ? new Date(a.started_at).getTime() : 0;
      const bDate = b.started_at ? new Date(b.started_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [caregivers]);

  const activeCaregiver = sortedCaregivers.find((c) => c.status === "active");
  const fallbackCaregiver = useMemo(() => {
    const derivedPhone =
      client.caregiver_phone ||
      (Array.isArray(client.phone_numbers) ? client.phone_numbers[1] : "") ||
      "";
    return {
      full_name: client.caregiver_name || "",
      relationship: client.caregiver_relationship || "",
      phone: derivedPhone,
      email: "",
      lives_in_home: Boolean(client.caregiver_lives_in_home),
      status: client.caregiver_name ? "active" : "inactive",
    };
  }, [client]);

  const displayCaregiver = activeCaregiver || fallbackCaregiver;
  const caregiverPhone = displayCaregiver?.phone || "";
  const initialRelationship = client?.caregiver_relationship || "";
  const [useCustomRelationship, setUseCustomRelationship] = useState(
    Boolean(initialRelationship && !CAREGIVER_RELATIONSHIPS.includes(initialRelationship))
  );
  useEffect(() => {
    if (
      form.relationship &&
      !CAREGIVER_RELATIONSHIPS.includes(form.relationship) &&
      !useCustomRelationship
    ) {
      setUseCustomRelationship(true);
    }
  }, [form.relationship, useCustomRelationship]);

  const [settings, setSettings] = useState(null);
  useEffect(() => {
    SettingsStore.get().then(s => {
      if (s?.caregiver_alerts) setSettings(s.caregiver_alerts);
    }).catch(console.error);
  }, []);

  const caregiverPhase = PHASES.find((phase) => phase.key === "onboarding");
  const onboardingFields = useMemo(() => {
    if (!caregiverPhase) return [];
    return caregiverPhase.items.map((item) => item.field);
  }, [caregiverPhase]);
  const caregiverPhaseIndex = PHASES.findIndex((phase) => phase.key === "onboarding");
  const nextPhaseKey =
    caregiverPhaseIndex >= 0 && caregiverPhaseIndex < PHASES.length - 1
      ? PHASES[caregiverPhaseIndex + 1].key
      : null;
  const phaseFinalized = caregiverPhase ? client?.[`${caregiverPhase.key}_finalized`] : false;
  const totalTasks = caregiverPhase?.items.length ?? 0;
  const completedTasks = useMemo(() => {
    if (!caregiverPhase || !activeCaregiver) return 0;
    return caregiverPhase.items.reduce(
      (total, item) => total + (activeCaregiver[item.field] ? 1 : 0),
      0
    );
  }, [activeCaregiver, caregiverPhase]);
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const canEdit = !readOnly;

  // Edit Date Modal State
  const [editingDate, setEditingDate] = useState(null); // { field, label, currentDate }

  const handleEditDate = (field, label, currentValue) => {
    if (!canEdit) return;
    setEditingDate({ field, label, value: currentValue || '' });
  };

  const saveDateEdit = async () => {
    if (!editingDate) return;
    try {
      console.log('Saving date:', editingDate);
      const val = editingDate.value === '' ? null : editingDate.value;
      await onUpdate({ [editingDate.field]: val });
      push({ title: "Date updated" });
      setEditingDate(null);
    } catch (e) {
      console.error("Failed to update date", e);
      push({ title: "Failed to update date", description: e.message || "Unknown error", variant: "destructive" });
    }
  }

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resolveMarketerUserId = async () => {
    try {
      if (client?.marketer?.user?.id) return client.marketer.user.id;
      if (client?.marketer?.user_id) return client.marketer.user_id;

      let marketerRecord = client?.marketer || null;
      if (!marketerRecord && client?.marketer_id) {
        marketerRecord = await Marketer.get(client.marketer_id);
      }

      if (marketerRecord?.user?.id) return marketerRecord.user.id;
      if (marketerRecord?.user_id) return marketerRecord.user_id;

      const emailCandidates = [
        marketerRecord?.email,
        client?.marketer_email,
      ].filter((email) => typeof email === "string" && email.includes("@"));

      for (const email of emailCandidates) {
        const marketerUser = await User.findByEmail(email);
        if (marketerUser?.id) return marketerUser.id;
      }
    } catch (error) {
      console.error("Failed to resolve marketer user", error);
    }
    return null;
  };

  const notifyCaregiverChange = async (action, caregiverName) => {
    if (!client?.id) return;
    try {
      console.log("🔔 Sending caregiver notification:", { action, caregiverName, clientId: client.id });
      const admins = await User.getByRole("admin");
      console.log("👥 Found admins:", admins?.length || 0, admins?.map(a => ({ id: a.id, email: a.email })));
      const recipientIds = new Set(
        (admins || []).map((admin) => admin.id).filter(Boolean)
      );

      const marketerUserId = await resolveMarketerUserId();
      console.log("🎯 Resolved marketer user ID:", marketerUserId);
      console.log("📊 Client data for marketer lookup:", {
        marketer: client?.marketer,
        marketer_id: client?.marketer_id,
        marketer_email: client?.marketer_email,
        director_of_marketing: client?.director_of_marketing
      });
      if (marketerUserId) {
        recipientIds.add(marketerUserId);
      }

      console.log("📬 Total recipients:", Array.from(recipientIds));
      if (!recipientIds.size) return;

      const title =
        action === "added" ? "New Caregiver Added" : "Caregiver Deactivated";
      const message =
        action === "added"
          ? `${caregiverName} was added as a caregiver for ${client.client_name}.`
          : `${caregiverName} was deactivated for ${client.client_name}.`;

      await Promise.all(
        Array.from(recipientIds).map((userId) =>
          Notification.create({
            user_id: userId,
            type: "client_updated",
            title,
            message,
            related_entity_type: "client",
            related_entity_id: client.id,
          })
        )
      );
      console.log("✅ Notifications sent successfully");
    } catch (error) {
      console.error("❌ Failed to send caregiver notification", error);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!(form.full_name || "").trim()) {
      nextErrors.full_name = "Name is required";
    }
    if (!(form.phone || "").trim()) {
      nextErrors.phone = "Phone is required";
    }
    return nextErrors;
  };

  const handleAddCaregiver = async () => {
    if (!canEdit) return;
    const validationErrors = validateForm();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSavingForm(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        relationship: form.relationship?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        lives_in_home: form.lives_in_home,
        notes: form.notes?.trim() || null,
      };
      await ClientCaregiver.addCaregiver(client.id, payload);

      const resetChecklist = onboardingFields.reduce(
        (acc, field) => ({ ...acc, [field]: false }),
        {}
      );

      await onUpdate({
        caregiver_name: payload.full_name,
        caregiver_relationship: payload.relationship,
        caregiver_phone: payload.phone,
        caregiver_lives_in_home: payload.lives_in_home,
        onboarding_finalized: false,
        current_phase: "onboarding",
        ...resetChecklist,
      });
      push({ title: "Caregiver added", description: `${payload.full_name} is now active.` });
      await notifyCaregiverChange("added", payload.full_name);
      setForm(defaultCaregiverForm);
      setErrors({});
      setIsAdding(false);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to add caregiver", error);
      push({
        title: "Unable to add caregiver",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleDeactivate = async () => {
    if (!canEdit || !activeCaregiver) return;
    setDeactivateConfirmText("");
    setDeactivateConfirmOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!canEdit || !activeCaregiver || deactivateConfirmText !== "CONFIRM") return;
    setIsDeactivating(true);
    try {
      await ClientCaregiver.deactivateCaregiver(activeCaregiver.id);
      await onUpdate({
        caregiver_name: null,
        caregiver_relationship: null,
        caregiver_phone: null,
        caregiver_lives_in_home: null,
      });
      push({ title: "Caregiver deactivated", description: activeCaregiver.full_name });
      await notifyCaregiverChange("deactivated", activeCaregiver.full_name);
      if (onRefresh) {
        await onRefresh();
      }
      setDeactivateConfirmOpen(false);
      setDeactivateConfirmText("");
    } catch (error) {
      console.error("Failed to deactivate caregiver", error);
      push({
        title: "Unable to deactivate",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  if (!caregiverPhase) return null;

  const handleFinalize = async () => {
    const confirmed = await confirm({
      title: "Finalize Caregiver Onboarding?",
      description: "This will lock the checklist for this phase.",
    });
    if (!confirmed) return;

    await onUpdate({ [`${caregiverPhase.key}_finalized`]: true });
    push({ title: `${caregiverPhase.label} finalized` });

    if (client.current_phase === caregiverPhase.key && nextPhaseKey) {
      await onUpdate({ current_phase: nextPhaseKey });
      push({
        title: `Moved to ${PHASES.find((p) => p.key === nextPhaseKey)?.label || "next phase"}`,
      });
    }
  };

  const isReadyToFinalize = caregiverPhase.items.every((item) => Boolean(client[item.field]));

  // Calculate expiration dates
  const cprExpiration = client.cpr_issued_at ? addYears(new Date(client.cpr_issued_at), 2) : null;
  const tbExpiration = client.tb_test_issued_at ? addYears(new Date(client.tb_test_issued_at), 1) : null;
  const trainingExpiration = client.training_or_care_start_date ? addYears(new Date(client.training_or_care_start_date), 1) : null;
  const licenseExpiration = client.drivers_license_expires_at ? new Date(client.drivers_license_expires_at) : null;

  // Determine status: 'ok', 'warning', 'error'
  const getStatus = (expirationDate, daysThreshold = 30) => {
    if (!expirationDate) return 'ok';
    const now = new Date();
    // Check if expired
    if (isBefore(expirationDate, now)) return 'error';
    // Check if within warning threshold
    if (isBefore(expirationDate, addDays(now, daysThreshold))) return 'warning';
    return 'ok';
  };

  return (
    <div className="space-y-8">
      <Card className="border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
            <Heart className="w-5 h-5 text-brand/70" />
            Caregiver Snapshot
          </CardTitle>
          {activeCaregiver?.id && (
            <Link to={`/caregiver/${activeCaregiver.id}`}>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                <ExternalLink className="w-4 h-4" />
                View Profile
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <ProfileImageUpload
              imageUrl={activeCaregiver?.profile_image_url}
              entityId={activeCaregiver?.id}
              entityType="caregiver"
              readOnly={true}
              size="lg"
            />
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold text-heading-primary">
                  {displayCaregiver?.full_name || "Caregiver TBD"}
                </h3>
                {displayCaregiver?.relationship && (
                  <Badge className="rounded-xl bg-[rgba(96,255,168,0.12)] text-heading-primary border border-brand/30 px-3 py-1">
                    {displayCaregiver.relationship}
                  </Badge>
                )}
                {activeCaregiver && (
                  <Badge className="rounded-xl bg-brand/15 text-brand border border-brand/40 px-3 py-1">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-heading-subdued text-sm">
                Primary caregiver for {client.client_name || "this client"}{" "}
                {displayCaregiver?.lives_in_home ? " • Lives in home" : ""}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <InfoRow icon={UserIcon} label="Client" value={client.client_name} />
                <InfoRow icon={MapPin} label="Location" value={client.location} />
                <InfoRow
                  icon={Home}
                  label="Lives In Home"
                  value={displayCaregiver?.lives_in_home ? "Yes" : "No"}
                />
                <InfoRow icon={Phone} label="Phone" value={caregiverPhone} />
                <InfoRow icon={Mail} label="Email" value={displayCaregiver?.email || client.email} />
                <InfoRow icon={Heart} label="Program" value={client.program} />

                {/* Expiration Dates */}
                <InfoRow
                  icon={getStatus(cprExpiration, settings?.cpr_days) !== 'ok' ? AlertTriangle : Calendar}
                  label="CPR | First Aid Expires"
                  value={cprExpiration ? format(cprExpiration, "MMM d, yyyy") : null}
                  status={getStatus(cprExpiration, settings?.cpr_days)}
                  onEdit={() => handleEditDate('cpr_issued_at', 'CPR Issued Date', client.cpr_issued_at)}
                />
                <InfoRow
                  icon={getStatus(tbExpiration, settings?.tb_days) !== 'ok' ? AlertTriangle : Calendar}
                  label="TB Test Expires"
                  value={tbExpiration ? format(tbExpiration, "MMM d, yyyy") : null}
                  status={getStatus(tbExpiration, settings?.tb_days)}
                  onEdit={() => handleEditDate('tb_test_issued_at', 'TB Test Issued Date', client.tb_test_issued_at)}
                />
                <InfoRow
                  icon={getStatus(licenseExpiration, settings?.drivers_license_days) !== 'ok' ? AlertTriangle : Calendar}
                  label="License Expires"
                  value={licenseExpiration ? format(licenseExpiration, "MMM d, yyyy") : null}
                  status={getStatus(licenseExpiration, settings?.drivers_license_days)}
                  onEdit={() => handleEditDate('drivers_license_expires_at', 'License Expiration Date', client.drivers_license_expires_at)}
                />
                <InfoRow
                  icon={getStatus(trainingExpiration, settings?.training_days) !== 'ok' ? AlertTriangle : Calendar}
                  label="Training Expires"
                  value={trainingExpiration ? format(trainingExpiration, "MMM d, yyyy") : null}
                  status={getStatus(trainingExpiration, settings?.training_days)}
                  onEdit={() => handleEditDate('training_or_care_start_date', 'Training / Start of Care Date', client.training_or_care_start_date)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Date Modal */}
      {editingDate && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditingDate(null)}
          />
          <div className="relative w-full max-w-sm mx-4 rounded-3xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold text-heading-primary">Update Date</h2>
              <p className="text-sm text-heading-subdued mt-2">
                Enter the new {editingDate.label.toLowerCase()}.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-[0.3em] text-heading-subdued">
                  {editingDate.label}
                </Label>
                <Input
                  type="date"
                  value={editingDate.value}
                  onChange={(e) => setEditingDate(prev => ({ ...prev, value: e.target.value }))}
                  className="mt-2"
                />
                <p className="text-[10px] text-heading-subdued mt-2">
                  Updating this date will automatically recalculate the expiration.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setEditingDate(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveDateEdit}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deactivateConfirmOpen && activeCaregiver && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isDeactivating && setDeactivateConfirmOpen(false)}
          />
          <div className="relative w-full max-w-md mx-4 rounded-3xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold text-heading-primary">Deactivate Caregiver</h2>
              <p className="text-sm text-heading-subdued mt-2">
                This will mark {activeCaregiver.full_name} as inactive and remove their details from
                the active slot. Type <span className="font-semibold text-heading-primary">CONFIRM</span> to continue.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-[0.3em] text-heading-subdued">
                  Confirmation
                </Label>
                <Input
                  value={deactivateConfirmText}
                  onChange={(e) => setDeactivateConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  disabled={isDeactivating}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-2xl border border-[rgba(147,165,197,0.25)] px-4 py-2 text-heading-subdued hover:border-brand/35 hover:bg-brand/10 transition-all disabled:opacity-50"
                  onClick={() => setDeactivateConfirmOpen(false)}
                  disabled={isDeactivating}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-heading-primary bg-red-500/90 border-red-500 hover:brightness-90 disabled:opacity-50"
                  onClick={handleConfirmDeactivate}
                  disabled={deactivateConfirmText !== "CONFIRM" || isDeactivating}
                >
                  {isDeactivating ? "Deactivating..." : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
            <Heart className="w-5 h-5 text-brand/70" />
            Manage Caregivers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative group">
              <Button
                type="button"
                variant="default"
                disabled={!canEdit || Boolean(activeCaregiver)}
                onClick={() => {
                  if (!canEdit || activeCaregiver) return;
                  setIsAdding((prev) => !prev);
                  setErrors({});
                }}
              >
                {isAdding ? "Close Form" : "Add New Caregiver"}
              </Button>
              {!canEdit || !activeCaregiver ? null : (
                <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-xl bg-black/80 px-3 py-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
                  Deactivate the current caregiver before adding another.
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!canEdit || !activeCaregiver || isDeactivating}
              onClick={handleDeactivate}
              className="gap-2"
            >
              {isDeactivating ? "Deactivating..." : "Deactivate Current"}
            </Button>
          </div>

          {isAdding && !activeCaregiver && (
            <div className="rounded-2xl border border-[rgba(147,165,197,0.25)] bg-black/20 p-5 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-heading-subdued text-xs uppercase tracking-[0.3em]">
                    Full Name
                  </Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => handleFormChange("full_name", e.target.value)}
                    placeholder="Caregiver full name"
                    className={errors.full_name ? "border-red-500" : ""}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-red-500">{errors.full_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-heading-subdued text-xs uppercase tracking-[0.3em]">
                    Relationship
                  </Label>
                  {!useCustomRelationship ? (
                    <Select
                      value={
                        CAREGIVER_RELATIONSHIPS.includes(form.relationship || "")
                          ? form.relationship
                          : ""
                      }
                      onValueChange={(value) => handleFormChange("relationship", value)}
                    >
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAREGIVER_RELATIONSHIPS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.relationship}
                      onChange={(e) => handleFormChange("relationship", e.target.value)}
                      placeholder="e.g., Daughter, Friend"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-heading-subdued text-xs uppercase tracking-[0.3em]">
                    Phone
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleFormChange("phone", formatPhone(e.target.value))}
                    placeholder="(555) 555-5555"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-heading-subdued text-xs uppercase tracking-[0.3em]">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      handleFormChange("email", e.target.value.toLowerCase().trim())
                    }
                    placeholder="caregiver@email.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-heading-subdued text-xs uppercase tracking-[0.3em]">
                  Notes
                </Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  placeholder="Add context for this caregiver..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="caregiver_lives_in_home"
                  checked={form.lives_in_home}
                  onCheckedChange={(val) => handleFormChange("lives_in_home", Boolean(val))}
                />
                <Label htmlFor="caregiver_lives_in_home" className="text-heading-subdued text-sm">
                  Caregiver lives in the client's home
                </Label>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setForm(defaultCaregiverForm);
                    setErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddCaregiver}
                  disabled={isSavingForm}
                  className="gap-2"
                >
                  {isSavingForm ? "Saving..." : "Save Caregiver"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs uppercase tracking-[0.3em] text-heading-subdued">
              Caregiver History
            </h4>
            {sortedCaregivers.length === 0 ? (
              <p className="text-heading-subdued text-sm mt-3">
                No caregiver records yet. Adding a caregiver will build this history.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {sortedCaregivers.map((cg) => (
                  <div
                    key={cg.id}
                    className={`rounded-2xl border p-4 space-y-2 ${cg.status === "active"
                      ? "border-[rgba(147,165,197,0.2)] bg-client-check"
                      : "border-[rgba(20,24,33,0.9)] bg-[rgba(4,7,15,0.85)] text-heading-subdued"
                      }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p
                          className={`font-semibold ${cg.status === "active" ? "text-heading-primary" : "text-heading-subdued"
                            }`}
                        >
                          {cg.full_name}
                        </p>
                        {cg.relationship && (
                          <p
                            className={`text-xs uppercase tracking-[0.3em] mt-1 ${cg.status === "active"
                              ? "text-heading-subdued"
                              : "text-heading-subdued/70"
                              }`}
                          >
                            {cg.relationship}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={
                          cg.status === "active"
                            ? "bg-brand/15 text-heading-primary border-brand/40"
                            : "bg-black/40 text-heading-subdued border-[rgba(147,165,197,0.05)]"
                        }
                      >
                        {cg.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p
                      className={`text-xs uppercase tracking-[0.3em] ${cg.status === "active" ? "text-heading-subdued" : "text-heading-subdued/70"
                        }`}
                    >
                      {formatRange(cg.started_at, cg.ended_at)}
                    </p>
                    <div
                      className={`grid sm:grid-cols-2 gap-2 text-sm ${cg.status === "active" ? "text-heading-subdued" : "text-heading-subdued/70"
                        }`}
                    >
                      {cg.phone && (
                        <span className="inline-flex items-center gap-2">
                          <Phone className={`w-4 h-4 ${cg.status === "active" ? "text-brand/60" : "text-heading-subdued/50"}`} />
                          {cg.phone}
                        </span>
                      )}
                      {cg.email && (
                        <span className="inline-flex items-center gap-2">
                          <Mail className={`w-4 h-4 ${cg.status === "active" ? "text-brand/60" : "text-heading-subdued/50"}`} />
                          {cg.email}
                        </span>
                      )}
                    </div>
                    {cg.notes && (
                      <p
                        className={`text-sm whitespace-pre-wrap ${cg.status === "active"
                          ? "text-heading-subdued/80"
                          : "text-heading-subdued/60"
                          }`}
                      >
                        {cg.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[rgba(96,255,168,0.18)]">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-heading-primary text-xl flex items-center gap-3 tracking-tight">
                <Heart className="w-5 h-5 text-brand/70" />
                Caregiver Onboarding
              </CardTitle>
              <p className="text-xs uppercase tracking-[0.3em] text-heading-subdued">
                {completedTasks}/{totalTasks} tasks complete
              </p>
            </div>
            <div className="w-full md:w-64">
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-heading-subdued mb-2">
                Completion {completionRate}%
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-4">
            {caregiverPhase.items.map((item) => {
              const checked = Boolean(activeCaregiver?.[item.field]);
              return (
                <div key={item.field} className={`${item.dateField ? 'flex flex-col gap-2 bg-black/10 p-4' : 'flex items-center gap-3 bg-black/10 px-4 py-3'} rounded-2xl border border-[rgba(147,165,197,0.25)]`}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={!canEdit || !activeCaregiver?.id}
                      onCheckedChange={async (val) => {
                        if (!canEdit || !activeCaregiver?.id) return;
                        // Update the caregiver record directly
                        await ClientCaregiver.update(activeCaregiver.id, { [item.field]: Boolean(val) });
                        onRefresh?.();
                        const allComplete = caregiverPhase.items.every((it) =>
                          it.field === item.field ? Boolean(val) : activeCaregiver[it.field]
                        );
                        if (allComplete) {
                          push({ title: "All caregiver onboarding tasks are complete. Submit to finalize." });
                        }
                      }}
                      className={`rounded-lg ${checked ? "data-[state=checked]:bg-brand data-[state=checked]:border-brand shadow-[0_0_0_3px_rgba(96,255,168,0.12)]" : ""}`}
                    />
                    <span className={`text-sm ${checked ? "text-heading-primary font-semibold" : "text-heading-subdued"}`}>
                      {item.label}
                    </span>
                  </div>

                  {item.dateField && (
                    <div className="ml-8 mt-1">
                      <Input
                        type="date"
                        value={activeCaregiver?.[item.dateField] || ''}
                        onChange={async (e) => {
                          if (!canEdit || !activeCaregiver?.id) return;
                          await ClientCaregiver.update(activeCaregiver.id, { [item.dateField]: e.target.value });
                          onRefresh?.();
                        }}
                        disabled={!canEdit}
                        className="h-9 text-xs rounded-lg w-full max-w-[200px]"
                      />
                      <p className="text-[10px] text-heading-subdued mt-1 uppercase tracking-wider">{item.dateLabel || 'Date'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              disabled={!canEdit || phaseFinalized || !isReadyToFinalize}
              onClick={handleFinalize}
            >
              {phaseFinalized ? "Finalized" : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
