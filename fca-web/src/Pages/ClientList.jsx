
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Client } from "@/entities/Client.supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Program from "@/entities/Program.supabase";
import { Search, Filter, Eye, Edit, Trash2, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import { useAuth } from "@/auth/AuthProvider.jsx";
import AddClientModal from "@/components/client/AddClientModal.jsx";

const phaseColors = {
  intake: 'bg-[rgba(99,255,130,0.16)] text-neutral-50 border-brand/45',
  onboarding: 'bg-[rgba(0,217,255,0.18)] text-neutral-50 border-[rgba(0,217,255,0.35)]',
  service_initiation: 'bg-[rgba(99,255,130,0.18)] text-neutral-50 border-brand/45'
};

const programColors = {
  'PSS': 'bg-[rgba(99,255,130,0.16)] text-neutral-50 border-brand/45',
  'PCA': 'bg-[rgba(0,217,255,0.18)] text-neutral-50 border-[rgba(0,217,255,0.35)]',
  'Companion Care': 'bg-[rgba(99,255,130,0.16)] text-neutral-50 border-brand/45',
  'Respite Care': 'bg-[rgba(0,217,255,0.18)] text-neutral-50 border-[rgba(0,217,255,0.35)]'
};

export default function ClientList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [programs, setPrograms] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmClient, setConfirmClient] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await Client.list("-created_at");
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
    setIsLoading(false);
  };

  const filterClients = useCallback(() => {
    let filtered = clients;

    // If marketer, only show their clients
    if (user?.role === 'marketer') {
      const nameKeyCandidates = ['director_of_marketing', 'marketer_name'];
      filtered = filtered.filter(c => nameKeyCandidates.some(k => (c?.[k] || '').trim() === (user.name || '').trim()));
    }

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.caregiver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (phaseFilter !== "all") {
      filtered = filtered.filter(client => client.current_phase === phaseFilter);
    }

    if (programFilter !== "all") {
      filtered = filtered.filter(client => client.program === programFilter);
    }

    setFilteredClients(filtered);
  }, [clients, searchTerm, phaseFilter, programFilter, user]);

  useEffect(() => {
    loadClients();
    // Prefill filters from query params (e.g., ?phase=intake)
    const params = new URLSearchParams(window.location.search);
    const phase = params.get('phase');
    if (phase) setPhaseFilter(phase);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await Program.list();
        setPrograms(list.map(p => p.name));
      } catch { }
    })();
  }, []);

  useEffect(() => {
    filterClients();
  }, [filterClients]);

  const formatPhaseDisplay = (phase) => {
    switch (phase) {
      case 'intake':
        return 'Client Intake';
      case 'onboarding':
        return 'Caregiver Onboarding';
      case 'service_initiation':
        return 'Services Initiated';
      default:
        return phase;
    }
  };

  const openDeleteConfirm = (client) => {
    setConfirmClient(client);
    setConfirmText("");
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmClient || confirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      await Client.remove(confirmClient.id);
      await loadClients();
      setConfirmOpen(false);
      setConfirmClient(null);
      setConfirmText("");
    } catch (e) {
      console.error("Failed to delete client", e);
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-10">
      <div className="space-y-10">
        {/* Header */}
        <SectionHeader
          eyebrow="Directory"
          title={user?.role === 'marketer' ? 'My Clients' : 'All Clients'}
          description={user?.role === 'marketer' ? 'View only the clients you referred.' : 'Manage and track operational data for every active client.'}
          actions={user?.role !== 'marketer' && (
            <Button
              variant="default"
              borderRadius="999px"
              className="gap-2 px-5"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Add Client
            </Button>
          )}
        />

        {/* Filters */}
        <Card className="border border-[rgba(96,255,168,0.18)] rounded-3xl relative z-10">
          <CardHeader className="p-6 border-b border-white/5">
            <CardTitle>
              <Filter className="w-5 h-5 text-brand/70" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand/80 w-4 h-4" />
                <Input
                  placeholder="Search clients, caregivers, or locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-2xl pl-12 py-3 bg-light-input border border-[rgba(147,165,197,0.25)] text-heading-primary placeholder-white/40 focus:border-brand focus:ring-brand/50"
                />
              </div>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="rounded-2xl py-3">
                  <SelectValue placeholder="Filter by phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  <SelectItem value="onboarding">Caregiver Onboarding</SelectItem>
                  <SelectItem value="intake">Client Intake</SelectItem>
                  <SelectItem value="service_initiation">Services Initiated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="rounded-2xl py-3">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Client Table - Desktop */}
        <Card className="hidden md:block border border-[rgba(96,255,168,0.16)] rounded-3xl relative z-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5">
                    <TableHead className="text-heading-subdued font-semibold p-6 uppercase tracking-[0.15em] text-xs">Client Name</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Caregiver</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Program</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Phase</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Location</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Frequency</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Intake Date</TableHead>
                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i} className="border-b border-white/5">
                        <TableCell className="text-heading-subdued p-6">Loading...</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                        <TableCell className="text-heading-subdued">-</TableCell>
                      </TableRow>
                    ))
                  ) : filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-heading-subdued py-12">
                        No clients found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="border-b border-white/5 hover:bg-light-chip transition-colors"
                      >
                        <TableCell className="font-semibold text-heading-primary p-6">
                          {client.client_name}
                        </TableCell>
                        <TableCell className="text-heading-primary/70">
                          <div>
                            <div className="font-medium text-heading-primary">{client.caregiver_name}</div>
                            {client.caregiver_relationship && (
                              <div className="text-sm text-kpi-secondary">
                                {client.caregiver_relationship}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${programColors[client.program] || 'bg-light-chip text-neutral-50'} px-3 py-1 rounded-lg font-medium`}>
                            {client.program}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${phaseColors[client.current_phase]} px-3 py-1 rounded-lg font-medium`}>
                            {formatPhaseDisplay(client.current_phase)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-kpi-secondary">
                          {client.location || '-'}
                        </TableCell>
                        <TableCell className="text-kpi-secondary">
                          {client.frequency || '-'}
                        </TableCell>
                        <TableCell className="text-kpi-secondary">
                          {client.intake_date
                            ? format(new Date(client.intake_date), 'MMM d, yyyy')
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-heading-primary/70">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              borderRadius="1rem"
                              className="rounded-2xl text-kpi-secondary hover:text-heading-primary"
                              onClick={() => navigate(createPageUrl('ClientDetail', { id: client.id }))}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {user?.role !== 'marketer' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  borderRadius="1rem"
                                  className="rounded-2xl text-kpi-secondary hover:text-heading-primary"
                                  onClick={() => navigate(createPageUrl('ClientDetail', { id: client.id }))}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  borderRadius="1rem"
                                  className="rounded-2xl text-kpi-secondary hover:text-heading-primary"
                                  onClick={() => openDeleteConfirm(client)}
                                  title="Delete client"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Client Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
                <CardContent className="p-4">
                  <div className="text-heading-subdued">Loading...</div>
                </CardContent>
              </Card>
            ))
          ) : filteredClients.length === 0 ? (
            <Card className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
              <CardContent className="p-6 text-center text-heading-subdued">
                No clients found matching your filters
              </CardContent>
            </Card>
          ) : (
            filteredClients.map((client) => (
              <Card
                key={client.id}
                className="border border-[rgba(96,255,168,0.16)] rounded-3xl hover:border-brand/40 transition-colors"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Client Name & Phase */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-heading-primary text-lg">
                        {client.client_name}
                      </h3>
                      <p className="text-sm text-kpi-secondary mt-1">
                        {client.intake_date
                          ? format(new Date(client.intake_date), 'MMM d, yyyy')
                          : '-'
                        }
                      </p>
                    </div>
                    <Badge className={`${phaseColors[client.current_phase]} px-3 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap`}>
                      {formatPhaseDisplay(client.current_phase)}
                    </Badge>
                  </div>

                  {/* Program Badge */}
                  <div>
                    <Badge className={`${programColors[client.program] || 'bg-light-chip text-neutral-50'} px-3 py-1.5 rounded-lg font-medium text-xs`}>
                      {client.program}
                    </Badge>
                  </div>

                  {/* Client Details Grid */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-heading-subdued uppercase tracking-wider min-w-[80px]">Caregiver</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-heading-primary">{client.caregiver_name}</div>
                        {client.caregiver_relationship && (
                          <div className="text-xs text-kpi-secondary">{client.caregiver_relationship}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-heading-subdued uppercase tracking-wider min-w-[80px]">Location</span>
                      <span className="text-sm text-heading-primary">{client.location || '-'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-heading-subdued uppercase tracking-wider min-w-[80px]">Frequency</span>
                      <span className="text-sm text-heading-primary">{client.frequency || '-'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-white/5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                      onClick={() => navigate(createPageUrl('ClientDetail', { id: client.id }))}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {user?.role !== 'marketer' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                          onClick={() => navigate(createPageUrl('ClientDetail', { id: client.id }))}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-2xl text-kpi-secondary hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => openDeleteConfirm(client)}
                          title="Delete client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setConfirmOpen(false)} />
            <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-4 text-amber-500">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-heading-primary">Delete Client?</h3>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-heading-subdued">
                  Are you sure you want to delete <span className="font-medium text-heading-primary">{confirmClient?.client_name}</span>? This action cannot be undone.
                </p>

                <div className="space-y-2">
                  <label className="text-xs text-heading-subdued uppercase tracking-wider">
                    Type <span className="text-brand font-bold">DELETE</span> to confirm
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="rounded-xl border-white/10 bg-black/20 focus:border-red-500/50"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setConfirmOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting || confirmText !== 'DELETE'}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(client) => {
          loadClients();
          navigate(createPageUrl('ClientDetail', { id: client.id }));
        }}
      />
    </div >
  );
}
