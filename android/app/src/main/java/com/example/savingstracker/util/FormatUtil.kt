package com.example.savingstracker.util

import java.text.NumberFormat
import java.util.Locale

fun formatYen(amount: Int): String {
    val formatter = NumberFormat.getNumberInstance(Locale.JAPAN)
    return "¥${formatter.format(amount)}"
}
