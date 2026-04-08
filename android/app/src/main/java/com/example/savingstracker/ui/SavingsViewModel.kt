package com.example.savingstracker.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.savingstracker.data.SavingsDatabase
import com.example.savingstracker.data.SavingsRecord
import com.example.savingstracker.data.SavingsRepository
import kotlinx.coroutines.launch

class SavingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SavingsRepository(
        SavingsDatabase.getDatabase(application).savingsDao()
    )

    val allRecords = repository.allRecords
    val totalSavings = repository.totalSavings
    val totalThisMonth = repository.totalThisMonth
    val categoryTotals = repository.categoryTotals
    val recordsThisMonth = repository.recordsThisMonth

    fun insert(record: SavingsRecord) = viewModelScope.launch {
        repository.insert(record)
    }

    fun delete(record: SavingsRecord) = viewModelScope.launch {
        repository.delete(record)
    }
}
