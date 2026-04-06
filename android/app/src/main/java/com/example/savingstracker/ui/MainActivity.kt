package com.example.savingstracker.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.savingstracker.databinding.ActivityMainBinding
import com.example.savingstracker.util.formatYen
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: SavingsViewModel by viewModels()
    private lateinit var adapter: SavingsAdapter

    private val addRecordLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        // Result is handled via ViewModel/LiveData automatically
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupObservers()
        setupClickListeners()
    }

    private fun setupRecyclerView() {
        adapter = SavingsAdapter()
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }

        // スワイプで削除
        val swipeHandler = object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT) {
            override fun onMove(rv: RecyclerView, vh: RecyclerView.ViewHolder, t: RecyclerView.ViewHolder) = false

            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
                val record = adapter.getRecordAt(viewHolder.adapterPosition)
                viewModel.delete(record)
                Snackbar.make(binding.root, "記録を削除しました", Snackbar.LENGTH_LONG)
                    .setAction("元に戻す") { viewModel.insert(record) }
                    .show()
            }
        }
        ItemTouchHelper(swipeHandler).attachToRecyclerView(binding.recyclerView)
    }

    private fun setupObservers() {
        viewModel.allRecords.observe(this) { records ->
            adapter.submitList(records)
            binding.emptyView.visibility = if (records.isEmpty())
                android.view.View.VISIBLE else android.view.View.GONE
        }

        viewModel.totalSavings.observe(this) { total ->
            binding.textTotalSavings.text = formatYen(total ?: 0)
        }

        viewModel.totalThisMonth.observe(this) { total ->
            binding.textMonthSavings.text = formatYen(total ?: 0)
        }
    }

    private fun setupClickListeners() {
        binding.fabAdd.setOnClickListener {
            val intent = Intent(this, AddRecordActivity::class.java)
            addRecordLauncher.launch(intent)
        }

        binding.buttonStats.setOnClickListener {
            startActivity(Intent(this, StatsActivity::class.java))
        }
    }
}
