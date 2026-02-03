import React, { useState, useEffect, useCallback } from "react";
import { ClientConnect } from "@/entities/ClientConnect.supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Eye, CheckCircle, Trash2, Plus, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, formatDistanceToNow } from "date-fns";
import SectionHeader from "@/components/layout/SectionHeader.jsx";
import { useAuth } from "@/auth/AuthProvider.jsx";
import AddClientConnectModal from "@/components/client/AddClientConnectModal.jsx";
import EditClientConnectModal from "@/components/client/EditClientConnectModal.jsx";

export default function ClientConnectList() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("pending");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmEntry, setConfirmEntry] = useState(null);
    const [isApproving, setIsApproving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteEntry, setDeleteEntry] = useState(null);
    const [editEntry, setEditEntry] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const loadEntries = async () => {
        setIsLoading(true);
        try {
            const data = await ClientConnect.list();
            setEntries(data);
        } catch (error) {
            console.error("Error loading client connect entries:", error);
        }
        setIsLoading(false);
    };

    const filterEntries = useCallback(() => {
        let filtered = entries;

        if (searchTerm) {
            filtered = filtered.filter(entry =>
                entry.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.caregiver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.program?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter && statusFilter !== "all") {
            filtered = filtered.filter(entry => entry.status === statusFilter);
        }

        setFilteredEntries(filtered);
    }, [entries, searchTerm, statusFilter]);

    useEffect(() => {
        loadEntries();
    }, []);

    useEffect(() => {
        filterEntries();
    }, [filterEntries]);

    const openApproveConfirm = (entry) => {
        setConfirmEntry(entry);
        setConfirmOpen(true);
    };

    const handleApprove = async () => {
        if (!confirmEntry) return;
        setIsApproving(true);
        try {
            const result = await ClientConnect.approve(confirmEntry.id);
            await loadEntries();
            setConfirmOpen(false);
            setConfirmEntry(null);
            // Navigate to the new client
            if (result.client?.id) {
                navigate(createPageUrl('ClientDetail', { id: result.client.id }));
            }
        } catch (e) {
            console.error("Failed to approve entry", e);
        }
        setIsApproving(false);
    };

    const openDeleteConfirm = (entry) => {
        setDeleteEntry(entry);
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteEntry) return;
        setIsDeleting(true);
        try {
            await ClientConnect.remove(deleteEntry.id);
            await loadEntries();
            setDeleteConfirmOpen(false);
            setDeleteEntry(null);
        } catch (e) {
            console.error("Failed to delete entry", e);
        }
        setIsDeleting(false);
    };

    const openEditModal = (entry) => {
        setEditEntry(entry);
        setIsEditModalOpen(true);
    };

    const handleEditSuccess = () => {
        loadEntries();
        setIsEditModalOpen(false);
        setEditEntry(null);
    };

    // Don't render for marketers
    if (user?.role === 'marketer') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-heading-subdued">You don't have access to this section.</p>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Header */}
            <SectionHeader
                eyebrow="Directory"
                title="Client Connect"
                description="Manage prospective clients before they become active."
                actions={(
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
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand/80 w-4 h-4" />
                            <Input
                                placeholder="Search by name, caregiver, or program..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="rounded-2xl pl-12 py-3 bg-light-input border border-[rgba(147,165,197,0.25)] text-heading-primary placeholder-white/40 focus:border-brand focus:ring-brand/50"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="rounded-2xl py-3">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table - Desktop */}
            <Card className="hidden md:block border border-[rgba(96,255,168,0.16)] rounded-3xl relative z-0">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-white/5">
                                    <TableHead className="text-heading-subdued font-semibold p-6 uppercase tracking-[0.15em] text-xs">Client Name</TableHead>
                                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Caregiver</TableHead>
                                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Program</TableHead>
                                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Date Entered</TableHead>
                                    <TableHead className="text-heading-subdued font-semibold uppercase tracking-[0.15em] text-xs">Status</TableHead>
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
                                        </TableRow>
                                    ))
                                ) : filteredEntries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-heading-subdued py-12">
                                            No entries found matching your filters
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEntries.map((entry) => (
                                        <TableRow
                                            key={entry.id}
                                            className={`border-b border-white/5 transition-colors ${entry.status === 'approved'
                                                ? 'opacity-50 bg-white/5'
                                                : 'hover:bg-light-chip'
                                                }`}
                                        >
                                            <TableCell className="font-semibold text-heading-primary p-6">
                                                {entry.client_name}
                                            </TableCell>
                                            <TableCell className="text-heading-primary/70">
                                                <div>
                                                    <div className="font-medium text-heading-primary">{entry.caregiver_name || '-'}</div>
                                                    {entry.relationship && (
                                                        <div className="text-sm text-kpi-secondary">
                                                            {entry.relationship}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {entry.program ? (
                                                    <Badge className="bg-light-chip text-neutral-50 px-3 py-1 rounded-lg font-medium">
                                                        {entry.program}
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-kpi-secondary">
                                                <div>
                                                    <div>{format(new Date(entry.created_at), 'MMM d, yyyy')}</div>
                                                    <div className="text-xs text-heading-subdued">
                                                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`px-3 py-1 rounded-lg font-medium ${entry.status === 'approved'
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                    }`}>
                                                    {entry.status === 'approved' ? 'Approved' : 'Pending'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-heading-primary/70">
                                                <div className="flex gap-2">
                                                    {entry.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                borderRadius="1rem"
                                                                className="rounded-2xl text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                                                onClick={() => openApproveConfirm(entry)}
                                                                title="Approve"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                borderRadius="1rem"
                                                                className="rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                                                                onClick={() => openEditModal(entry)}
                                                                title="Edit"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {entry.status === 'approved' && entry.client_id && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            borderRadius="1rem"
                                                            className="rounded-2xl text-kpi-secondary hover:text-heading-primary"
                                                            onClick={() => navigate(createPageUrl('ClientDetail', { id: entry.client_id }))}
                                                            title="View Client"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        borderRadius="1rem"
                                                        className="rounded-2xl text-kpi-secondary hover:text-red-400"
                                                        onClick={() => openDeleteConfirm(entry)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
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

            {/* Cards - Mobile */}
            <div className="md:hidden space-y-4">
                {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                        <Card key={i} className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
                            <CardContent className="p-4">
                                <div className="text-heading-subdued">Loading...</div>
                            </CardContent>
                        </Card>
                    ))
                ) : filteredEntries.length === 0 ? (
                    <Card className="border border-[rgba(96,255,168,0.16)] rounded-3xl">
                        <CardContent className="p-6 text-center text-heading-subdued">
                            No entries found matching your filters
                        </CardContent>
                    </Card>
                ) : (
                    filteredEntries.map((entry) => (
                        <Card
                            key={entry.id}
                            className={`border border-[rgba(96,255,168,0.16)] rounded-3xl transition-colors ${entry.status === 'approved' ? 'opacity-50' : 'hover:border-brand/40'
                                }`}
                        >
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-heading-primary text-lg">
                                            {entry.client_name}
                                        </h3>
                                        <p className="text-sm text-kpi-secondary mt-1">
                                            {format(new Date(entry.created_at), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <Badge className={`px-3 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap ${entry.status === 'approved'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                        }`}>
                                        {entry.status === 'approved' ? 'Approved' : 'Pending'}
                                    </Badge>
                                </div>

                                {entry.program && (
                                    <Badge className="bg-light-chip text-neutral-50 px-3 py-1.5 rounded-lg font-medium text-xs">
                                        {entry.program}
                                    </Badge>
                                )}

                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    {entry.caregiver_name && (
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs text-heading-subdued uppercase tracking-wider min-w-[80px]">Caregiver</span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-heading-primary">{entry.caregiver_name}</div>
                                                {entry.relationship && (
                                                    <div className="text-xs text-kpi-secondary">{entry.relationship}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-white/5">
                                    {entry.status === 'pending' && (
                                        <>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 rounded-2xl gap-2"
                                                onClick={() => openApproveConfirm(entry)}
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Approve
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                                                onClick={() => openEditModal(entry)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                    {entry.status === 'approved' && entry.client_id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="flex-1 rounded-2xl text-kpi-secondary hover:text-heading-primary hover:bg-light-chip"
                                            onClick={() => navigate(createPageUrl('ClientDetail', { id: entry.client_id }))}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Client
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-2xl text-kpi-secondary hover:text-red-400 hover:bg-red-500/10"
                                        onClick={() => openDeleteConfirm(entry)}
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Approve Confirmation Modal */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isApproving && setConfirmOpen(false)} />
                    <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4 text-green-500">
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-heading-primary">Approve Client?</h3>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-heading-subdued">
                                This will create a new client record for <span className="font-medium text-heading-primary">{confirmEntry?.client_name}</span>
                                {confirmEntry?.caregiver_name && (
                                    <> and a caregiver record for <span className="font-medium text-heading-primary">{confirmEntry?.caregiver_name}</span></>
                                )}.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setConfirmOpen(false)}
                                disabled={isApproving}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                className="rounded-full"
                                onClick={handleApprove}
                                disabled={isApproving}
                            >
                                {isApproving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Approving...
                                    </>
                                ) : (
                                    'Approve & Create'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirmOpen(false)} />
                    <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-4 text-amber-500">
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-heading-primary">Delete Entry?</h3>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-heading-subdued">
                                Are you sure you want to delete <span className="font-medium text-heading-primary">{deleteEntry?.client_name}</span>? This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setDeleteConfirmOpen(false)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                className="rounded-full"
                                onClick={handleDelete}
                                disabled={isDeleting}
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

            {/* Add Client Connect Modal */}
            <AddClientConnectModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => {
                    loadEntries();
                }}
            />

            {/* Edit Client Connect Modal */}
            <EditClientConnectModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditEntry(null);
                }}
                onSuccess={handleEditSuccess}
                entry={editEntry}
            />
        </div>
    );
}
