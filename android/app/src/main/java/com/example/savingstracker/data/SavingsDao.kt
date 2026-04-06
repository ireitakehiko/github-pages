package com.example.savingstracker.data

import androidx.lifecycle.LiveData
import androidx.room.*

@Dao
interface SavingsDao {

    @Insert
    suspend fun insert(record: SavingsRecord)

    @Delete
    suspend fun delete(record: SavingsRecord)

    @Query("SELECT * FROM savings_records ORDER BY timestamp DESC")
    fun getAllRecords(): LiveData<List<SavingsRecord>>

    @Query("SELECT SUM(amount) FROM savings_records")
    fun getTotalSavings(): LiveData<Int?>

    @Query("SELECT category, SUM(amount) as total FROM savings_records GROUP BY category ORDER BY total DESC")
    fun getCategoryTotals(): LiveData<List<CategoryTotal>>

    @Query("SELECT * FROM savings_records WHERE timestamp >= :startOfMonth ORDER BY timestamp DESC")
    fun getRecordsThisMonth(startOfMonth: Long): LiveData<List<SavingsRecord>>

    @Query("SELECT SUM(amount) FROM savings_records WHERE timestamp >= :startOfMonth")
    fun getTotalThisMonth(startOfMonth: Long): LiveData<Int?>
}

data class CategoryTotal(
    val category: String,
    val total: Int
)
