package com.example.savingstracker.data

import androidx.lifecycle.LiveData
import java.util.Calendar

class SavingsRepository(private val dao: SavingsDao) {

    val allRecords: LiveData<List<SavingsRecord>> = dao.getAllRecords()
    val totalSavings: LiveData<Int?> = dao.getTotalSavings()
    val categoryTotals: LiveData<List<CategoryTotal>> = dao.getCategoryTotals()

    val totalThisMonth: LiveData<Int?> = dao.getTotalThisMonth(startOfCurrentMonth())
    val recordsThisMonth: LiveData<List<SavingsRecord>> = dao.getRecordsThisMonth(startOfCurrentMonth())

    suspend fun insert(record: SavingsRecord) = dao.insert(record)

    suspend fun delete(record: SavingsRecord) = dao.delete(record)

    private fun startOfCurrentMonth(): Long {
        return Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
}
