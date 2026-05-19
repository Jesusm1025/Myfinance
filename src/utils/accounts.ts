import type { Account, AccountTransfer, Movement } from '../types/finance'

export type AccountBalance = Account & {
  income: number
  expenses: number
  incomingTransfers: number
  outgoingTransfers: number
  balance: number
}

export function buildAccountBalances(
  accounts: Account[],
  movements: Movement[],
  transfers: AccountTransfer[],
): AccountBalance[] {
  const balances = new Map<string, AccountBalance>(
    accounts.map((account) => [
      account.id,
      {
        ...account,
        income: 0,
        expenses: 0,
        incomingTransfers: 0,
        outgoingTransfers: 0,
        balance: Number(account.initial_balance),
      },
    ]),
  )

  movements.forEach((movement) => {
    if (!movement.account_id) return
    const account = balances.get(movement.account_id)
    if (!account) return
    const amount = Number(movement.amount)
    if (movement.type === 'income') {
      account.income += amount
      account.balance += amount
    } else {
      account.expenses += amount
      account.balance -= amount
    }
  })

  transfers.forEach((transfer) => {
    const amount = Number(transfer.amount)
    const fromAccount = balances.get(transfer.from_account_id)
    const toAccount = balances.get(transfer.to_account_id)

    if (fromAccount) {
      fromAccount.outgoingTransfers += amount
      fromAccount.balance -= amount
    }
    if (toAccount) {
      toAccount.incomingTransfers += amount
      toAccount.balance += amount
    }
  })

  return Array.from(balances.values()).sort((a, b) => b.balance - a.balance)
}

export function totalAccountBalance(accounts: AccountBalance[]) {
  return accounts.reduce((total, account) => total + account.balance, 0)
}
