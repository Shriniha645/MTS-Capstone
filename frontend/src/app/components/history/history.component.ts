import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { TransactionService } from '../../services/transaction.service';
import { TransactionLog } from '../../models/api.models';

interface TransactionStatistics {
  totalTransactions: number;
  totalSent: number;
  totalReceived: number;
  netChange: number;
  successRate: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MatDialogModule,
    RouterLink
  ],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  allTransactions: TransactionLog[] = [];
  filteredTransactions: TransactionLog[] = [];
  isLoading = true;
  errorMessage = '';
  accountId: number | null = null;
  
  filterForm: FormGroup;
  statistics: TransactionStatistics = {
    totalTransactions: 0,
    totalSent: 0,
    totalReceived: 0,
    netChange: 0,
    successRate: 0
  };
  
  displayedColumns: string[] = ['id', 'date', 'type', 'account', 'amount', 'status'];
  
  datePresets = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Custom', value: 'custom' }
  ];
  
  sortOptions = [
    { label: 'Date (Newest First)', value: 'date_desc' },
    { label: 'Date (Oldest First)', value: 'date_asc' },
    { label: 'Amount (Highest First)', value: 'amount_desc' },
    { label: 'Amount (Lowest First)', value: 'amount_asc' }
  ];

  constructor(
    private authService: AuthService,
    private transactionService: TransactionService,
    private router: Router,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {
    this.filterForm = this.fb.group({
      datePreset: ['month'],
      startDate: [null],
      endDate: [null],
      transactionType: ['all'],
      status: ['all'],
      transactionId: [''],
      accountId: [''],
      minAmount: [null],
      maxAmount: [null],
      sortBy: ['date_desc']
    });
  }

  ngOnInit(): void {
    this.loadTransactionHistory();
    this.setupFilterListeners();
  }

  setupFilterListeners(): void {
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  loadTransactionHistory(): void {
    this.accountId = this.authService.getAccountId();
    
    if (!this.accountId) {
      this.errorMessage = 'Account not found. Please login again.';
      this.isLoading = false;
      return;
    }

    this.transactionService.getAccountTransactionHistory(this.accountId).subscribe({
      next: (transactions) => {
        this.allTransactions = transactions.sort((a, b) => 
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.errorMessage || 'Failed to load transaction history';
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.allTransactions];
    const filters = this.filterForm.value;
    
    // Date Range Filter
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (filters.datePreset !== 'custom') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate = new Date();
      
      switch (filters.datePreset) {
        case 'today':
          startDate = new Date(today);
          break;
        case 'week':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'thisMonth':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
      }
    } else {
      // Use custom dates
      startDate = filters.startDate ? new Date(filters.startDate) : null;
      endDate = filters.endDate ? new Date(filters.endDate) : null;
    }
    
    // Apply date filters
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => new Date(t.createdOn) >= startDate!);
    }
    
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.createdOn) <= endDate!);
    }
    
    // Transaction Type Filter
    if (filters.transactionType !== 'all') {
      filtered = filtered.filter(t => {
        const type = this.getTransactionType(t);
        return type === filters.transactionType;
      });
    }
    
    // Status Filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    
    // Transaction ID Filter
    if (filters.transactionId && filters.transactionId.trim()) {
      const transactionId = filters.transactionId.trim();
      filtered = filtered.filter(t => t.id.toString().includes(transactionId));
    }
    
    // Account ID Filter
    if (filters.accountId && filters.accountId.trim()) {
      const accountId = filters.accountId.trim();
      filtered = filtered.filter(t => 
        t.fromAccountId.toString().includes(accountId) ||
        t.toAccountId.toString().includes(accountId)
      );
    }
    
    // Amount Range Filter
    if (filters.minAmount !== null && filters.minAmount !== '') {
      const minAmount = parseFloat(filters.minAmount);
      if (!isNaN(minAmount)) {
        filtered = filtered.filter(t => t.amount >= minAmount);
      }
    }
    
    if (filters.maxAmount !== null && filters.maxAmount !== '') {
      const maxAmount = parseFloat(filters.maxAmount);
      if (!isNaN(maxAmount)) {
        filtered = filtered.filter(t => t.amount <= maxAmount);
      }
    }
    
    // Apply Sorting
    this.applySorting(filtered, filters.sortBy);
    
    this.filteredTransactions = filtered;
    this.calculateStatistics();
  }
  
  applySorting(transactions: TransactionLog[], sortBy: string): void {
    switch (sortBy) {
      case 'date_desc':
        transactions.sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());
        break;
      case 'date_asc':
        transactions.sort((a, b) => new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime());
        break;
      case 'amount_desc':
        transactions.sort((a, b) => b.amount - a.amount);
        break;
      case 'amount_asc':
        transactions.sort((a, b) => a.amount - b.amount);
        break;
    }
  }

  calculateStatistics(): void {
    let totalSent = 0;
    let totalReceived = 0;
    let successCount = 0;
    
    this.filteredTransactions.forEach(transaction => {
      const type = this.getTransactionType(transaction);
      
      if (type === 'DEBIT') {
        totalSent += transaction.amount;
      } else {
        totalReceived += transaction.amount;
      }
      
      if (transaction.status === 'SUCCESS') {
        successCount++;
      }
    });
    
    this.statistics = {
      totalTransactions: this.filteredTransactions.length,
      totalSent,
      totalReceived,
      netChange: totalReceived - totalSent,
      successRate: this.filteredTransactions.length > 0 
        ? (successCount / this.filteredTransactions.length) * 100 
        : 0
    };
  }

  clearFilters(): void {
    this.filterForm.reset({
      datePreset: 'month',
      startDate: null,
      endDate: null,
      transactionType: 'all',
      status: 'all',
      transactionId: '',
      accountId: '',
      minAmount: null,
      maxAmount: null,
      sortBy: 'date_desc'
    });
  }

  refreshTransactions(): void {
    this.isLoading = true;
    this.loadTransactionHistory();
  }

  exportToCSV(): void {
    if (this.filteredTransactions.length === 0) {
      alert('No transactions to export');
      return;
    }

    const headers = ['Transaction ID', 'Date & Time', 'Type', 'From Account', 'To Account', 'Amount', 'Status'];
    const csvData = this.filteredTransactions.map(t => [
      t.id,
      this.formatDate(t.createdOn),
      this.getTransactionType(t),
      t.fromAccountId,
      t.toAccountId,
      t.amount,
      t.status
    ]);

    let csv = headers.join(',') + '\n';
    csvData.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  getActiveFilterCount(): number {
    let count = 0;
    const filters = this.filterForm.value;
    
    if (filters.transactionType !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.transactionId && filters.transactionId.trim()) count++;
    if (filters.accountId && filters.accountId.trim()) count++;
    if (filters.minAmount !== null && filters.minAmount !== '') count++;
    if (filters.maxAmount !== null && filters.maxAmount !== '') count++;
    
    return count;
  }
  
  viewTransactionDetails(transaction: TransactionLog): void {
    const dialogRef = this.dialog.open(TransactionDetailsDialog, {
      width: '600px',
      data: {
        transaction,
        accountId: this.accountId,
        type: this.getTransactionType(transaction),
        otherAccount: this.getOtherAccountId(transaction)
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  getTransactionType(transaction: TransactionLog): string {
    return transaction.fromAccountId === this.accountId ? 'DEBIT' : 'CREDIT';
  }

  getOtherAccountId(transaction: TransactionLog): number {
    return transaction.fromAccountId === this.accountId 
      ? transaction.toAccountId 
      : transaction.fromAccountId;
  }

  getTransactionTypeClass(transaction: TransactionLog): string {
    return this.getTransactionType(transaction) === 'DEBIT' 
      ? 'transaction-debit' 
      : 'transaction-credit';
  }

  getTransactionTypeIcon(transaction: TransactionLog): string {
    return this.getTransactionType(transaction) === 'DEBIT' 
      ? 'arrow_upward' 
      : 'arrow_downward';
  }

  getStatusClass(status: string): string {
    return status === 'SUCCESS' ? 'status-success' : 'status-failed';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Transaction Details Dialog Component
@Component({
  selector: 'transaction-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <h2 mat-dialog-title style="color: #044014; display: flex; align-items: center; gap: 10px;">
      <mat-icon [style.color]="data.type === 'DEBIT' ? '#dc3545' : '#28a745'">receipt</mat-icon>
      Transaction Details
    </h2>
    <mat-dialog-content class="py-4">
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Transaction ID</span>
          <span class="detail-value"><strong>{{ data.transaction.id }}</strong></span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date & Time</span>
          <span class="detail-value">{{ formatDetailDate(data.transaction.createdOn) }}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Type</span>
          <span class="detail-value">
            <mat-chip [style.background-color]="data.type === 'DEBIT' ? '#dc3545' : '#28a745'"
                      style="color: white; font-weight: 500;">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px; margin-right: 4px;">
                {{ data.type === 'DEBIT' ? 'arrow_upward' : 'arrow_downward' }}
              </mat-icon>
              {{ data.type === 'DEBIT' ? 'Money Sent' : 'Money Received' }}
            </mat-chip>
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">From Account</span>
          <span class="detail-value">
            <strong>{{ data.transaction.fromAccountId }}</strong>
            {{ data.transaction.fromAccountId === data.accountId ? ' (You)' : '' }}
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">To Account</span>
          <span class="detail-value">
            <strong>{{ data.transaction.toAccountId }}</strong>
            {{ data.transaction.toAccountId === data.accountId ? ' (You)' : '' }}
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Amount</span>
          <span class="detail-value" [style.color]="data.type === 'DEBIT' ? '#dc3545' : '#28a745'"
                style="font-size: 1.5rem; font-weight: bold;">
            {{ data.type === 'DEBIT' ? '-' : '+' }}{{ formatDetailCurrency(data.transaction.amount) }}
          </span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">
            <mat-chip [style.background-color]="data.transaction.status === 'SUCCESS' ? '#28a745' : '#dc3545'"
                      style="color: white; font-weight: 500;">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px; margin-right: 4px;">
                {{ data.transaction.status === 'SUCCESS' ? 'check_circle' : 'cancel' }}
              </mat-icon>
              {{ data.transaction.status }}
            </mat-chip>
          </span>
        </div>
        
        <div class="detail-row" *ngIf="data.type === 'DEBIT'">
          <span class="detail-label">Recipient</span>
          <span class="detail-value">Account #{{ data.otherAccount }}</span>
        </div>
        
        <div class="detail-row" *ngIf="data.type === 'CREDIT'">
          <span class="detail-label">Sender</span>
          <span class="detail-value">Account #{{ data.otherAccount }}</span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="pb-3 px-3">
      <button mat-raised-button mat-dialog-close style="background-color: #368727; color: white;">
        <mat-icon>close</mat-icon>
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .detail-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .detail-row {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 20px;
      padding: 15px;
      background: rgba(54, 135, 39, 0.05);
      border-radius: 8px;
      border-left: 3px solid #368727;
    }
    
    .detail-label {
      color: #044014;
      font-weight: 600;
      font-size: 0.9rem;
    }
    
    .detail-value {
      color: #044014;
      font-size: 1rem;
      display: flex;
      align-items: center;
    }
    
    mat-dialog-content {
      max-height: 70vh;
      overflow-y: auto;
    }
  `]
})
export class TransactionDetailsDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
  
  formatDetailDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  formatDetailCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }
}
