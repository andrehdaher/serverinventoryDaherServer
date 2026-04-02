import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { ref, get, set, update, remove } from "firebase/database";
import { database } from "../firebaseConfig";
import { Account } from "../types/account";


const getAccountNature = (type: string): "Debit" | "Credit" => {
  if (type === "Asset" || type === "Expense") return "Debit";
  return "Credit";
};


export const createAccount = async (req : Request , res : Response)=>{
      try {
    const {
      name,
      code,
      type,
      category,
      parentId,
      openingBalance,
      currentBalance,
      currency,
      description,
    } = req.body;

        if (!name || !name.trim()) {
      return res.status(400).json({ error: "اسم الحساب مطلوب" });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "رمز الحساب مطلوب" });
    }

    if (!type || !type.trim()) {
      return res.status(400).json({ error: "نوع الحساب مطلوب" });
    }
        const numericOpeningBalance = Number(openingBalance || 0);

    if (isNaN(numericOpeningBalance)) {
      return res.status(400).json({ error: "الرصيد الافتتاحي يجب أن يكون رقماً" });
    }

    if (!type || !type.trim()) {
      return res.status(400).json({ error: "نوع الحساب مطلوب" });
    }
        const numeriCcurrentBalance = Number(currentBalance || 0);

    if (isNaN(numeriCcurrentBalance)) {
      return res.status(400).json({ error: "الرصيد الافتتاحي يجب أن يكون رقماً" });
    }
   const dbRef = ref(database, "accounts");
    const snapshot = await get(dbRef);
    const accounts = snapshot.exists() ? Object.values(snapshot.val()) : [];

    const existingCode = (accounts as any[]).find(
      (acc) => acc.code?.trim() === code.trim()
    );

    if (existingCode) {
      return res.status(400).json({ error: "رمز الحساب مستخدم مسبقاً" });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const account: Account = {
      id,
      name: name.trim(),
      code: code.trim(),
      type: type.trim(),
      category: category?.trim() || undefined,
      parentId: parentId || null,
      nature: getAccountNature(type),
      openingBalance: numericOpeningBalance,
      currentBalance: numeriCcurrentBalance,
      currency: currency || "USD",
      description: description?.trim() || undefined,
      isActive: true,
      isSystem: false,
      allowTransactions: true,
      createdAt: now,
      updatedAt: now,
    };

    await set(ref(database, `accounts/${id}`), account);
        res.status(201).json(account);

}
catch (error: any) {
    console.error("Error creating account:", error);
    res.status(500).json({ error: "فشل في إنشاء الحساب" });
  }

}

export const getAccount = async (req:Request , res:Response)=>{
    try{
        const dbRef = ref(database , 'accounts')
    const snapshot = await get(dbRef);
    const accounts = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.status(200).json(accounts);
    
    }catch (error: any) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "فشل في جلب الحسابات" });
  }

}

export const updateAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            code,
            type,
            category,
            parentId,
            currentBalance,
            currency,
            description,
            isActive,
            allowTransactions,
        } = req.body;

        if (!id) {
            return res.status(400).json({ error: "معرف الحساب مطلوب" });
        }

        // التحقق من وجود الحساب
        const accountRef = ref(database, `accounts/${id}`);
        const snapshot = await get(accountRef);

        if (!snapshot.exists()) {
            return res.status(404).json({ error: "الحساب غير موجود" });
        }

        const currentAccount = snapshot.val();

        // التحقق من الرمز إذا تم تغييره
        if (code && code.trim() !== currentAccount.code) {
            const dbRef = ref(database, "accounts");
            const allSnapshot = await get(dbRef);
            const accounts = allSnapshot.exists() ? Object.values(allSnapshot.val()) : [];
            
            const existingCode = (accounts as any[]).find(
                (acc) => acc.code?.trim() === code.trim() && acc.id !== id
            );

            if (existingCode) {
                return res.status(400).json({ error: "رمز الحساب مستخدم مسبقاً" });
            }
        }

        const numericCurrentBalance = currentBalance !== undefined ? Number(currentBalance) : currentAccount.currentBalance;

        if (isNaN(numericCurrentBalance)) {
            return res.status(400).json({ error: "الرصيد يجب أن يكون رقماً" });
        }

        const now = new Date().toISOString();

        const updatedAccount: Partial<Account> = {
            ...currentAccount,
            ...(name && { name: name.trim() }),
            ...(code && { code: code.trim() }),
            ...(type && { type: type.trim(), nature: getAccountNature(type) }),
            ...(category !== undefined && { category: category?.trim() || undefined }),
            ...(parentId !== undefined && { parentId: parentId || null }),
            currentBalance: numericCurrentBalance,
            ...(currency && { currency }),
            ...(description !== undefined && { description: description?.trim() || undefined }),
            ...(isActive !== undefined && { isActive }),
            ...(allowTransactions !== undefined && { allowTransactions }),
            updatedAt: now,
        };

        await update(ref(database, `accounts/${id}`), updatedAccount);

        res.status(200).json(updatedAccount);
    } catch (error: any) {
        console.error("Error updating account:", error);
        res.status(500).json({ error: "فشل في تحديث الحساب" });
    }
}

export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: "معرف الحساب مطلوب" });
        }
        
        // التحقق من وجود الحساب
        const accountRef = ref(database, `accounts/${id}`);
        const snapshot = await get(accountRef);
        

        if (!snapshot.exists()) {
            return res.status(404).json({ error: "الحساب غير موجود" });
        }

        const account = snapshot.val();

        // منع حذف الحسابات النظام
        if (account.isSystem) {
            return res.status(403).json({ error: "لا يمكن حذف الحسابات النظام" });
        }

        // حذف الحساب
        await remove(accountRef);

        res.status(200).json({ message: "تم حذف الحساب بنجاح", id });
    } catch (error: any) {
        console.error("Error deleting account:", error);
        res.status(500).json({ error: "فشل في حذف الحساب" });
    }
}

export const updateAccountBalanceInternal = async ({
  accountId,
  entryType,
  amount,
}: {
  accountId: string;
  entryType: "debit" | "credit";
  amount: number;
}): Promise<Account> => {
  const accountRef = ref(database, `accounts/${accountId}`);
  const snapshot = await get(accountRef);

  if (!snapshot.exists()) {
    throw new Error("الحساب غير موجود");
  }

  const account: Account = snapshot.val();

  if (!account.allowTransactions) {
    throw new Error("هذا الحساب لا يسمح بإجراء حركات عليه");
  }

  const numericAmount = Number(amount);

  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error("قيمة الحركة يجب أن تكون أكبر من صفر");
  }

  let newBalance = account.currentBalance;

  if (account.nature === "Debit") {
    if (entryType === "debit") {
      newBalance = account.currentBalance + numericAmount;
    } else {
      newBalance = account.currentBalance - numericAmount;
    }
  } else {
    if (entryType === "credit") {
      newBalance = account.currentBalance + numericAmount;
    } else {
      newBalance = account.currentBalance - numericAmount;
    }
  }

  const updatedAccount: Account = {
    ...account,
    currentBalance: newBalance,
    updatedAt: new Date().toISOString(),
  };

  await update(accountRef, {
    currentBalance: updatedAccount.currentBalance,
    updatedAt: updatedAccount.updatedAt,
  });

  return updatedAccount;
}

const getCollectionValues = async (path: string) => {
  const snapshot = await get(ref(database, path));
  return snapshot.exists() ? Object.values(snapshot.val()) : [];
};

const hasMatchingAccountId = (
  item: Record<string, any>,
  accountId: string,
  keys: string[]
) => {
  return keys.some((key) => item?.[key] === accountId);
};

export const getAccountDetails = async( req: Request , res : Response)=>{
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({ error: "معرف الحساب مطلوب" });
    }

    const accountRef = ref(database , `accounts/${id}`);
    const accountSnapshot = await get(accountRef);

    if (!accountSnapshot.exists()) {
      return res.status(404).json({ error: "الحساب غير موجود" });
    }

    const account = accountSnapshot.val();

    const [
      payments,
      purchases,
      sells,
      customers,
      suppliers,
    ] = await Promise.all([
      getCollectionValues("payment"),
      getCollectionValues("purchases"),
      getCollectionValues("sells"),
      getCollectionValues("customer"),
      getCollectionValues("supplier"),
    ]);

    const relatedData = {
      payments: (payments as Record<string, any>[]).filter((item) =>
        hasMatchingAccountId(item, id, [
          "paymentAccountId",
          "receivableAccountId",
          "payableAccountId",
          "salesAccountId",
          "expenseAccountId",
        ])
      ),
      purchases: (purchases as Record<string, any>[]).filter((item) =>
        hasMatchingAccountId(item, id, [
          "inventoryAccountId",
          "payableAccountId",
          "paymentAccountId",
        ])
      ),
      sells: (sells as Record<string, any>[]).filter((item) =>
        hasMatchingAccountId(item, id, [
          "paymentAccountId",
          "receivableAccountId",
          "salesAccountId",
        ])
      ),
      customers: (customers as Record<string, any>[]).filter((item) =>
        hasMatchingAccountId(item, id, [
          "defaultPaymentAccountId",
          "defaultReceivableAccountId",
          "defaultSalesAccountId",
        ])
      ),
      suppliers: (suppliers as Record<string, any>[]).filter((item) =>
        hasMatchingAccountId(item, id, [
          "defaultPaymentAccountId",
          "defaultPayableAccountId",
          "defaultInventoryAccountId",
        ])
      ),
    };
    return res.status(200).json({
      account,
      relatedData,
    });
  } catch (error: any) {
    console.error("Error fetching account details:", error);
    return res.status(500).json({ error: "فشل في جلب تفاصيل الحساب" });
  }
}
