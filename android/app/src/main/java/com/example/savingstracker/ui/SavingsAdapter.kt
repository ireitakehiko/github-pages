package com.example.savingstracker.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.savingstracker.data.SavingsRecord
import com.example.savingstracker.databinding.ItemSavingsRecordBinding
import com.example.savingstracker.util.formatYen
import java.text.SimpleDateFormat
import java.util.*

class SavingsAdapter : ListAdapter<SavingsRecord, SavingsAdapter.ViewHolder>(DIFF_CALLBACK) {

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<SavingsRecord>() {
            override fun areItemsTheSame(old: SavingsRecord, new: SavingsRecord) = old.id == new.id
            override fun areContentsTheSame(old: SavingsRecord, new: SavingsRecord) = old == new
        }
        private val DATE_FORMAT = SimpleDateFormat("M/d (E)", Locale.JAPAN)
    }

    inner class ViewHolder(private val binding: ItemSavingsRecordBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(record: SavingsRecord) {
            binding.textAmount.text = formatYen(record.amount)
            binding.textCategory.text = record.category
            binding.textMemo.text = record.memo
            binding.textDate.text = DATE_FORMAT.format(Date(record.timestamp))
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemSavingsRecordBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    fun getRecordAt(position: Int): SavingsRecord = getItem(position)
}
