package com.example.savingstracker.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [SavingsRecord::class], version = 1, exportSchema = false)
abstract class SavingsDatabase : RoomDatabase() {

    abstract fun savingsDao(): SavingsDao

    companion object {
        @Volatile
        private var INSTANCE: SavingsDatabase? = null

        fun getDatabase(context: Context): SavingsDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    SavingsDatabase::class.java,
                    "savings_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
