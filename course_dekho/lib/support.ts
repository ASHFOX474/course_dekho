export interface SupportTicket {
  id: string;
  userId: string | null;
  category: 'recovery' | 'problem' | 'suggestion';
  subject: string;
  contactName: string;
  contactEmail: string;
  accountIdentifier: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
}
export interface SupportMessage { id: string; sender: 'requester' | 'admin'; body: string; createdAt: string }
export interface SupportThread { ticket: SupportTicket; messages: SupportMessage[] }
