import { useState, useEffect } from "react";
import { API_BASE_URL } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  UserPlus,
  Users as UsersIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner@2.0.3";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  lastActive?: string;
}

interface ManageUsersViewProps {
  currentUser: { name: string; email: string; role: "admin" | "user" } | null;
}

export function ManageUsersView({ currentUser }: ManageUsersViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user" as "admin" | "user",
    password: "",
  });

  const API_URL = API_BASE_URL;
  const isAdmin = currentUser?.role === "admin";
  const isLoggedIn = !!currentUser;

  const getToken = () => localStorage.getItem("token");

  // ===============================
  // 🚀 LOAD USERS
  // ===============================
  useEffect(() => {
    if (!isAdmin) return;

    async function loadUsers() {
      try {
        const res = await fetch(`${API_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        if (!res.ok) throw new Error("Failed to load users");

        const data = await res.json();
        setUsers(data.users);
      } catch (err) {
        toast.error("Error loading users");
      }
    }
    loadUsers();
  }, [isAdmin]);

  // ===============================
  // 🚀 ADD USER
  // ===============================
  const handleAddUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to add user");

      const data = await res.json();
      setUsers([...users, data.user]);
      setFormData({ name: "", email: "", role: "user", password: "" });
      setIsAddDialogOpen(false);
      toast.success("User added successfully");
    } catch (err) {
      toast.error("Error adding user");
    }
  };

  // ===============================
  // 🚀 EDIT USER
  // ===============================
  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role };
      if (formData.password) payload.password = formData.password;

      const res = await fetch(`${API_URL}/auth/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to edit user");

      const updated = await res.json();
      setUsers(users.map(u => (u.id === selectedUser.id ? updated.user : u)));
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setFormData({ name: "", email: "", role: "user", password: "" });
      toast.success("User edited successfully");
    } catch (err) {
      toast.error("Error editing user");
    }
  };

  // ===============================
  // 🚀 DELETE USER
  // ===============================
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`${API_URL}/auth/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) throw new Error("Failed to delete user");

      setUsers(users.filter(u => u.id !== selectedUser.id));
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      toast.success("User deleted successfully");
    } catch (err) {
      toast.error("Error deleting user");
    }
  };

  // ===============================
  // UI Helpers
  // ===============================
  const adminCount = users.filter(u => u.role === "admin").length;
  const userCount = users.filter(u => u.role === "user").length;

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role, password: "" });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  

  return (
    <div>
      {!isLoggedIn && (
        <Card className="mb-6 p-4 border border-yellow-200 bg-yellow-50">
          <div className="text-yellow-800">You are not logged in. Sign in to view and manage users.</div>
        </Card>
      )}
      {isLoggedIn && !isAdmin && (
        <Card className="mb-6 p-4 border border-red-200 bg-red-50">
          <div className="text-red-800">You do not have permission to manage users.</div>
        </Card>
      )}
      {/* --- Stats --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--brand-blue-light)] rounded-lg">
              <UsersIcon className="w-6 h-6 text-[var(--brand-blue)]" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Admins</p>
              <p className="text-2xl text-slate-900">{adminCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <UsersIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Users</p>
              <p className="text-2xl text-slate-900">{userCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* --- Add User Button --- */}
      <div className="flex items-center justify-end mb-4">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!isAdmin}>
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Register a new user in the system.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-password">Password</Label>
                <Input
                  id="add-password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={value => setFormData({ ...formData, role: value as "admin" | "user" })}
                >
                  <SelectTrigger id="add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAddUser}
                disabled={!formData.name || !formData.email || !formData.password}
              >
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- Users Table --- */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="text-slate-900">{user.name}</TableCell>
                <TableCell className="text-slate-600">{user.email}</TableCell>
                <TableCell>
                  <Badge className="capitalize">{user.role}</Badge>
                </TableCell>
                <TableCell className="text-slate-600">{user.createdAt}</TableCell>
                <TableCell className="text-slate-600">{user.lastActive}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => isAdmin && openEditDialog(user)} disabled={!isAdmin}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => isAdmin && openDeleteDialog(user)} disabled={!isAdmin}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* --- Edit User Dialog --- */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Change Password (optional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={value => setFormData({ ...formData, role: value as "admin" | "user" })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleEditUser}
              disabled={!formData.name || !formData.email}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Delete User Dialog --- */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="text-slate-900">{selectedUser?.name}</span> ({selectedUser?.email}) from the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
