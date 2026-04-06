package com.example.savingstracker.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "savings_records")
data class SavingsRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val amount: Int,           // 節約した金額（円）
    val category: String,      // カテゴリ（食費、交通費、など）
    val memo: String,          // 何を我慢したか
    val timestamp: Long = System.currentTimeMillis()
)
