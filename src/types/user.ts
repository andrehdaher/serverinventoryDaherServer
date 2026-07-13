export interface InventoryUser {
  id?: string;
  username: string;
  password?: string;
  role: string;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryUserResponse {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}
