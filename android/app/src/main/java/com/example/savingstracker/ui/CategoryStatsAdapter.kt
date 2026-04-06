package com.example.savingstracker.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.savingstracker.data.CategoryTotal
import com.example.savingstracker.databinding.ItemCategoryStatsBinding
import com.example.savingstracker.util.formatYen

class CategoryStatsAdapter : ListAdapter<CategoryTotal, CategoryStatsAdapter.ViewHolder>(DIFF_CALLBACK) {

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<CategoryTotal>() {
            override fun areItemsTheSame(old: CategoryTotal, new: CategoryTotal) =
                old.category == new.category
            override fun areContentsTheSame(old: CategoryTotal, new: CategoryTotal) = old == new
        }
    }

    inner class ViewHolder(private val binding: ItemCategoryStatsBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: CategoryTotal, maxTotal: Int) {
            binding.textCategory.text = item.category
            binding.textTotal.text = formatYen(item.total)
            binding.progressBar.max = maxTotal
            binding.progressBar.progress = item.total
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemCategoryStatsBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val maxTotal = currentList.maxOfOrNull { it.total } ?: 1
        holder.bind(getItem(position), maxTotal)
    }
}
