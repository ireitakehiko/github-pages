package com.example.savingstracker.ui

import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import com.example.savingstracker.R
import com.example.savingstracker.data.SavingsRecord
import com.example.savingstracker.databinding.ActivityAddRecordBinding

class AddRecordActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAddRecordBinding
    private val viewModel: SavingsViewModel by viewModels()

    private val categories = listOf(
        "食費", "飲み物", "外食", "交通費", "ショッピング",
        "娯楽", "美容", "サブスク", "その他"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAddRecordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.apply {
            title = "我慢を記録"
            setDisplayHomeAsUpEnabled(true)
        }

        setupQuickAmountChips()
        setupCategoryDropdown()
        setupSaveButton()
    }

    private fun setupQuickAmountChips() {
        val amounts = mapOf(
            binding.chip100 to 100,
            binding.chip300 to 300,
            binding.chip500 to 500,
            binding.chip1000 to 1000,
            binding.chip3000 to 3000
        )
        amounts.forEach { (chip, amount) ->
            chip.setOnClickListener {
                binding.editAmount.setText(amount.toString())
                binding.layoutAmount.error = null
            }
        }
    }

    private fun setupCategoryDropdown() {
        val adapter = ArrayAdapter(this, R.layout.item_dropdown, categories)
        binding.autoCompleteCategory.setAdapter(adapter)
        binding.autoCompleteCategory.setText(categories[0], false)
    }

    private fun setupSaveButton() {
        binding.buttonSave.setOnClickListener {
            val amountText = binding.editAmount.text.toString().trim()
            val category = binding.autoCompleteCategory.text.toString().trim()
            val memo = binding.editMemo.text.toString().trim()

            if (amountText.isEmpty()) {
                binding.layoutAmount.error = "金額を入力してください"
                return@setOnClickListener
            }

            val amount = amountText.toIntOrNull()
            if (amount == null || amount <= 0) {
                binding.layoutAmount.error = "正しい金額を入力してください"
                return@setOnClickListener
            }

            if (category.isEmpty()) {
                binding.layoutCategory.error = "カテゴリを選択してください"
                return@setOnClickListener
            }

            val record = SavingsRecord(
                amount = amount,
                category = category,
                memo = memo.ifEmpty { "${category}を我慢した" }
            )

            viewModel.insert(record)
            Toast.makeText(this, "¥${amount}の節約を記録しました！", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
