package com.example.savingstracker.ui

import android.os.Bundle
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.savingstracker.databinding.ActivityStatsBinding
import com.example.savingstracker.util.formatYen

class StatsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityStatsBinding
    private val viewModel: SavingsViewModel by viewModels()
    private lateinit var categoryAdapter: CategoryStatsAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityStatsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.apply {
            title = "統計"
            setDisplayHomeAsUpEnabled(true)
        }

        categoryAdapter = CategoryStatsAdapter()
        binding.recyclerCategories.apply {
            layoutManager = LinearLayoutManager(this@StatsActivity)
            adapter = categoryAdapter
        }

        viewModel.totalSavings.observe(this) { total ->
            binding.textTotalAllTime.text = formatYen(total ?: 0)
        }

        viewModel.totalThisMonth.observe(this) { total ->
            binding.textTotalMonth.text = formatYen(total ?: 0)
        }

        viewModel.categoryTotals.observe(this) { totals ->
            categoryAdapter.submitList(totals)
        }

        viewModel.allRecords.observe(this) { records ->
            binding.textRecordCount.text = "${records.size}件"
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
