import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, Car, Bike, 
  CreditCard, Calendar, ChevronRight, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Info, AlertCircle, Plus, Download, Upload, FileText, Moon, Sun, X, Save
} from "lucide-react";
import { FINANCE_DATA as INITIAL_DATA } from "./data";
import { formatCurrency, cn } from "./lib/utils";
import { FinanceData, MonthData, CategorizedExpense, VehicleExpense, Loan, Investment, LoanPayment } from "./types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function App() {
  const [data, setData] = useState<FinanceData>(() => {
    const saved = localStorage.getItem("finance_data_v3");
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "vehicles" | "loans" | "settings">("overview");
  const [selectedYear, setSelectedYear] = useState<number>(data.months[data.months.length - 1]?.year || 2026);
  const [selectedMonth, setSelectedMonth] = useState<string>(data.months.filter(m => m.year === (data.months[data.months.length - 1]?.year || 2026))[data.months.filter(m => m.year === (data.months[data.months.length - 1]?.year || 2026)).length - 1]?.month || "");
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("finance_data_v3", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const stats = useMemo(() => {
    const getMonthStats = (month: string, year: number) => {
      const monthData = data.months.find(m => m.month === month && m.year === year);
      const monthSavings = data.savings.filter(s => s.month === month && s.year === year).reduce((a, b) => a + (b.value as number), 0);
      const monthInvestments = data.investments?.filter(i => i.month === month && i.year === year).reduce((a, b) => a + b.value, 0) || 0;
      const monthLoanIncome = data.loans.filter(l => l.month === month && l.year === year).reduce((a, b) => a + b.totalValue, 0);
      const monthLoanPayments = data.loanPayments?.filter(p => p.month === month && p.year === year).reduce((a, b) => a + b.value, 0) || 0;
      const monthVehicleExpenses = data.vehicleExpenses.filter(e => e.month === month && e.year === year).reduce((a, b) => a + b.value, 0);
      const monthCategorizedExpenses = data.categorizedExpenses.filter(e => e.month === month && e.year === year).reduce((a, b) => a + b.value, 0);
      
      const baseIncome = monthData ? Object.values(monthData.income || {}).reduce((a, b) => (a as number) + (b as number), 0) as number : 0;
      const totalIncome = baseIncome + monthLoanIncome;
      const baseExpenses = monthData ? Object.values(monthData.expenses || {}).reduce((a, b) => (a as number) + (b as number), 0) as number : 0;
      const totalExpenses = baseExpenses + monthLoanPayments;
      
      return {
        income: totalIncome,
        expenses: totalExpenses,
        balance: totalIncome - totalExpenses - monthInvestments,
        savings: monthSavings,
        investments: monthInvestments
      };
    };

    const current = getMonthStats(selectedMonth, selectedYear);
    
    // Calculate previous month
    const monthIndex = MONTHS.indexOf(selectedMonth);
    let prevMonth = "";
    let prevYear = selectedYear;
    
    if (monthIndex === 0) {
      prevMonth = MONTHS[11];
      prevYear = selectedYear - 1;
    } else if (monthIndex > 0) {
      prevMonth = MONTHS[monthIndex - 1];
    }
    
    const previous = prevMonth ? getMonthStats(prevMonth, prevYear) : null;
    
    const calculateTrend = (curr: number, prev: number | undefined) => {
      if (prev === undefined || prev === 0) return "0%";
      const diff = ((curr - prev) / prev) * 100;
      if (diff === 0) return "0%";
      return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
    };

    return {
      ...current,
      incomeTrend: previous ? calculateTrend(current.income, previous.income) : "Início",
      expensesTrend: previous ? calculateTrend(current.expenses, previous.expenses) : "Início",
      balanceTrend: previous ? calculateTrend(current.balance, previous.balance) : "Início",
      savingsTrend: previous ? calculateTrend(current.savings, previous.savings) : "Início",
      investmentsTrend: previous ? calculateTrend(current.investments, previous.investments) : "Início"
    };
  }, [selectedMonth, selectedYear, data]);

  const chartData = useMemo(() => {
    return data.months.filter(m => m.year === selectedYear).map(m => {
      const baseIncome = Object.values(m.income || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
      const monthLoanIncome = data.loans.filter(l => l.month === m.month && l.year === m.year).reduce((a, b) => a + b.totalValue, 0);
      const monthLoanPayments = data.loanPayments?.filter(p => p.month === m.month && p.year === m.year).reduce((a, b) => a + b.value, 0) || 0;
      const totalIncome = baseIncome + monthLoanIncome;
      
      const baseExpenses = Object.values(m.expenses || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
      const totalExpenses = baseExpenses + monthLoanPayments;
      const monthInvestments = data.investments?.filter(i => i.month === m.month && i.year === m.year).reduce((a, b) => a + b.value, 0) || 0;
      
      return {
        name: m.month,
        Renda: totalIncome,
        Gastos: totalExpenses,
        Saldo: totalIncome - totalExpenses - monthInvestments
      };
    });
  }, [selectedYear, data]);

  const expenseBreakdown = useMemo(() => {
    const expenses = data.categorizedExpenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
    const grouped = expenses.reduce((acc: any, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.value;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value: value as number }));
  }, [selectedMonth, selectedYear, data]);

  const vehicleStats = useMemo(() => {
    const expenses = data.vehicleExpenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
    
    const carFuel = expenses.filter(e => e.type === "Carro" && e.category === "Combustível").reduce((a, b) => a + b.value, 0);
    const carMaint = expenses.filter(e => e.type === "Carro" && e.category === "Manutenção").reduce((a, b) => a + b.value, 0);
    const carOther = expenses.filter(e => e.type === "Carro" && e.category !== "Combustível" && e.category !== "Manutenção").reduce((a, b) => a + b.value, 0);
    
    const motoFuel = expenses.filter(e => e.type === "Moto" && e.category === "Combustível").reduce((a, b) => a + b.value, 0);
    const motoMaint = expenses.filter(e => e.type === "Moto" && e.category === "Manutenção").reduce((a, b) => a + b.value, 0);
    const motoOther = expenses.filter(e => e.type === "Moto" && e.category !== "Combustível" && e.category !== "Manutenção").reduce((a, b) => a + b.value, 0);
    
    return { 
      carTotal: carFuel + carMaint + carOther, 
      carFuel, 
      carMaint, 
      motoTotal: motoFuel + motoMaint + motoOther, 
      motoFuel, 
      motoMaint 
    };
  }, [selectedMonth, selectedYear, data]);

  const annualStats = useMemo(() => {
    let baseIncome = 0;
    let totalExpenses = 0;

    const filteredMonths = data.months.filter(m => m.year === selectedYear);
    filteredMonths.forEach(m => {
      baseIncome += Object.values(m.income || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
      totalExpenses += Object.values(m.expenses || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
    });

    const totalLoanIncome = data.loans.filter(l => l.year === selectedYear).reduce((a, b) => a + b.totalValue, 0);
    const totalLoanPayments = data.loanPayments?.filter(p => p.year === selectedYear).reduce((a, b) => a + b.value, 0) || 0;
    const totalVehicleExpenses = data.vehicleExpenses.filter(e => e.year === selectedYear).reduce((a, b) => a + b.value, 0);
    const totalCategorizedExpenses = data.categorizedExpenses.filter(e => e.year === selectedYear).reduce((a, b) => a + b.value, 0);
    
    const totalIncome = baseIncome + totalLoanIncome;
    const totalInvestments = data.investments?.filter(i => i.year === selectedYear).reduce((a, b) => a + b.value, 0) || 0;

    return { 
      totalIncome, 
      totalExpenses: totalExpenses + totalLoanPayments, 
      totalInvestments 
    };
  }, [selectedYear, data]);

  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        setData(importedData);
        
        // Set initial year and month from imported data
        if (importedData.months && importedData.months.length > 0) {
          const lastMonth = importedData.months[importedData.months.length - 1];
          setSelectedYear(lastMonth.year);
          setSelectedMonth(lastMonth.month);
        }
        
        alert("Dados importados com sucesso!");
      } catch (err) {
        alert("Erro ao importar arquivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  const generatePDF = async () => {
    if (!pdfRef.current) return;
    
    const element = pdfRef.current;
    
    try {
      // Ensure the element is visible for html2canvas
      element.style.display = "block";
      element.style.position = "fixed";
      element.style.left = "0";
      element.style.top = "0";
      element.style.zIndex = "-1"; // Behind everything
      
      // Wait a bit longer for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        windowWidth: 1024,
      });
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("O relatório gerado está vazio. Verifique se há dados para o ano selecionado.");
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      
      // Extract the base64 part for more reliable format detection in some jsPDF versions
      const base64Data = imgData.split(',')[1];
      if (!base64Data) {
        throw new Error("Falha ao gerar dados base64 da imagem.");
      }

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Pass the base64 data and explicitly state the format
      pdf.addImage(base64Data, "JPEG", 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`relatorio_financeiro_anual_${selectedYear}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o relatório PDF. Tente novamente.");
    } finally {
      element.style.display = "none";
      element.style.position = "";
      element.style.left = "";
    }
  };

  const handleAddEntry = (type: string, entry: any) => {
    setData(prev => {
      const newData = { ...prev };
      
      if (type === "month") {
        newData.months = [...newData.months, entry];
      } else if (type === "income" || type === "fixed_expense") {
        // Update the specific month's income or expense object
        newData.months = newData.months.map(m => {
          if (m.month === entry.month && m.year === entry.year) {
            if (type === "income") {
              return { ...m, income: { ...m.income, [entry.field]: entry.value } };
            } else {
              return { ...m, expenses: { ...m.expenses, [entry.field]: entry.value } };
            }
          }
          return m;
        });
      } else if (type === "expense") {
        newData.categorizedExpenses = [...newData.categorizedExpenses, entry];
      } else if (type === "vehicle") {
        newData.vehicleExpenses = [...newData.vehicleExpenses, entry];
      } else if (type === "investment") {
        newData.investments = [...(newData.investments || []), entry];
      } else if (type === "loan") {
        if (editingLoan) {
          const diff = entry.paidInstallments - editingLoan.paidInstallments;
          if (diff > 0) {
            const paymentValue = diff * entry.installmentValue;
            const newPayment: LoanPayment = {
              id: Math.random().toString(36).substr(2, 9),
              loanId: editingLoan.id,
              value: paymentValue,
              month: selectedMonth,
              year: selectedYear
            };
            newData.loanPayments = [...(newData.loanPayments || []), newPayment];
          }
          newData.loans = newData.loans.map(l => l.id === editingLoan.id ? { 
            ...entry, 
            id: editingLoan.id,
            endMonth: entry.paidInstallments === entry.installments ? selectedMonth : l.endMonth
          } : l);
        } else {
          newData.loans = [...newData.loans, entry];
        }
      }
      
      return newData;
    });
    setIsAddModalOpen(false);
    setEditingLoan(null);
  };

  const payOffLoan = (loanId: string) => {
    if (confirm("Tem certeza que deseja quitar este empréstimo?")) {
      setData(prev => {
        const loan = prev.loans.find(l => l.id === loanId);
        if (!loan) return prev;
        
        const remainingInstallments = loan.installments - loan.paidInstallments;
        const totalPayment = remainingInstallments * loan.installmentValue;
        
        const newPayment: LoanPayment = {
          id: Math.random().toString(36).substr(2, 9),
          loanId: loanId,
          value: totalPayment,
          month: selectedMonth,
          year: selectedYear
        };

        return {
          ...prev,
          loans: prev.loans.map(l => 
            l.id === loanId ? { ...l, paidInstallments: l.installments, endMonth: selectedMonth } : l
          ),
          loanPayments: [...(prev.loanPayments || []), newPayment]
        };
      });
    }
  };

  const activeLoans = useMemo(() => {
    const loansInYear = data.loans.filter(l => l.year === selectedYear);
    const loansWithPaymentsInYear = data.loans.filter(l => 
      data.loanPayments?.some(p => p.loanId === l.id && p.year === selectedYear)
    );
    const combined = Array.from(new Set([...loansInYear, ...loansWithPaymentsInYear]));
    return combined;
  }, [data.loans, data.loanPayments, selectedYear]);

  const handleEditLoan = (loan: Loan) => {
    setEditingLoan(loan);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* PDF Report Template (Hidden) */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, height: 0, overflow: "hidden" }}>
        <div ref={pdfRef} className="p-8 bg-white text-slate-900 w-[210mm] pdf-report">
          <AnnualPdfReportTemplate data={data} year={selectedYear} />
        </div>
      </div>

      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-full md:border-t-0 md:border-r md:justify-start md:pt-8 md:gap-4">
        <div className="hidden md:flex items-center gap-2 mb-8 px-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Wallet size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight">FinAnalyzer</span>
        </div>

        {[
          { id: "overview", label: "Visão Geral", icon: PieChartIcon },
          { id: "expenses", label: "Despesas", icon: CreditCard },
          { id: "vehicles", label: "Veículos", icon: Car },
          { id: "loans", label: "Empréstimos", icon: AlertCircle },
          { id: "settings", label: "Ações", icon: Save },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all md:flex-row md:w-full md:px-4 md:py-3 md:gap-3",
              activeTab === tab.id 
                ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30 md:bg-blue-600 md:text-white" 
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <tab.icon size={20} />
            <span className="text-[10px] font-medium md:text-sm">{tab.label}</span>
          </button>
        ))}

        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="hidden md:flex items-center gap-3 w-full px-4 py-3 mt-auto text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span className="text-sm font-medium">{isDarkMode ? "Modo Claro" : "Modo Escuro"}</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="pb-24 pt-6 px-4 md:ml-64 md:pt-8 md:px-8 max-w-7xl mx-auto" ref={reportRef}>
        <header className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Dashboard Financeiro</h1>
            <p className="text-slate-500 dark:text-slate-400">Acompanhe sua saúde financeira de {selectedYear}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm self-start">
              <select 
                value={selectedYear}
                onChange={(e) => {
                  const year = parseInt(e.target.value);
                  setSelectedYear(year);
                  const firstMonthOfYear = data.months.find(m => m.year === year)?.month || "";
                  setSelectedMonth(firstMonthOfYear);
                }}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 px-2 cursor-pointer outline-none"
              >
                {Array.from(new Set(data.months.map(m => m.year))).sort().map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
              {data.months.filter(m => m.year === selectedYear).map(m => (
                <button
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    selectedMonth === m.month 
                      ? "bg-slate-900 dark:bg-blue-600 text-white shadow-md" 
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  {m.month}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="hidden sm:inline text-sm font-bold">Novo Lançamento</span>
            </button>

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="md:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {data.months.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-6">
                <FileText size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Nenhum dado encontrado</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                Comece importando um backup existente ou adicione seu primeiro lançamento para começar a acompanhar suas finanças.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-3 rounded-xl font-bold cursor-pointer hover:opacity-90 transition-all">
                  <Upload size={20} />
                  Importar Backup
                  <input type="file" accept=".json" onChange={importFromJson} className="hidden" />
                </label>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
                >
                  <Plus size={20} />
                  Novo Lançamento
                </button>
              </div>
            </motion.div>
          ) : activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card 
                  title="Renda Total" 
                  value={stats.income} 
                  icon={TrendingUp} 
                  color="text-emerald-600" 
                  bgColor="bg-emerald-50 dark:bg-emerald-900/20"
                  trend={stats.incomeTrend}
                />
                <Card 
                  title="Gastos Totais" 
                  value={stats.expenses} 
                  icon={TrendingDown} 
                  color="text-rose-600" 
                  bgColor="bg-rose-50 dark:bg-rose-900/20"
                  trend={stats.expensesTrend}
                />
                <Card 
                  title="Investimentos" 
                  value={stats.investments} 
                  icon={PieChartIcon} 
                  color="text-amber-600" 
                  bgColor="bg-amber-50 dark:bg-amber-900/20"
                  trend={stats.investmentsTrend}
                />
                <Card 
                  title="Saldo Final" 
                  value={stats.balance} 
                  icon={Wallet} 
                  color="text-blue-600" 
                  bgColor="bg-blue-50 dark:bg-blue-900/20"
                  trend={stats.balanceTrend}
                />
                <Card 
                  title="Economias" 
                  value={stats.savings} 
                  icon={PiggyBank} 
                  color="text-indigo-600" 
                  bgColor="bg-indigo-50 dark:bg-indigo-900/20"
                  trend={stats.savingsTrend}
                />
              </div>

              {/* Annual Summary & Vehicle Overview */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" />
                    Resumo Anual Acumulado
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase">Renda Anual</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(annualStats.totalIncome)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase">Gastos Anuais</p>
                      <p className="text-2xl font-bold text-rose-600">{formatCurrency(annualStats.totalExpenses)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase">Investimentos</p>
                      <p className="text-2xl font-bold text-amber-600">{formatCurrency(annualStats.totalInvestments)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 uppercase">Saldo Anual</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        annualStats.totalIncome - annualStats.totalExpenses - annualStats.totalInvestments >= 0 ? "text-blue-600" : "text-rose-600"
                      )}>
                        {formatCurrency(annualStats.totalIncome - annualStats.totalExpenses - annualStats.totalInvestments)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Car size={20} className="text-blue-600" />
                    Resumo de Veículos
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Total no Mês</span>
                      <span className="font-bold">{formatCurrency(vehicleStats.carTotal + vehicleStats.motoTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Total no Ano</span>
                      <span className="font-bold">{formatCurrency(data.vehicleExpenses.reduce((a, b) => a + b.value, 0))}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full" 
                        style={{ width: `${Math.min(100, ((vehicleStats.carTotal + vehicleStats.motoTotal) / (stats.expenses || 1)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">Representa {((vehicleStats.carTotal + vehicleStats.motoTotal) / (stats.expenses || 1) * 100).toFixed(1)}% dos gastos do mês.</p>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    Tendência Mensal
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRenda" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Area type="monotone" dataKey="Renda" stroke="#10b981" fillOpacity={1} fill="url(#colorRenda)" strokeWidth={2} />
                        <Area type="monotone" dataKey="Gastos" stroke="#ef4444" fillOpacity={1} fill="url(#colorGastos)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <PieChartIcon size={20} className="text-blue-600" />
                    Distribuição de Gastos
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "expenses" && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Detalhamento de Despesas - {selectedMonth}</h3>
                  <span className="text-sm text-slate-500">{data.categorizedExpenses.filter(e => e.month === selectedMonth && e.year === selectedYear).length} transações</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Descrição</th>
                        <th className="px-6 py-4 font-semibold">Categoria</th>
                        <th className="px-6 py-4 font-semibold text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.categorizedExpenses
                        .filter(e => e.month === selectedMonth && e.year === selectedYear)
                        .map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-medium">{expense.description}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                                {expense.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-rose-600">
                              {formatCurrency(expense.value)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "vehicles" && (
            <motion.div
              key="vehicles"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                      <Car size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold">Gastos com Carro</h3>
                      <p className="text-sm text-slate-500">Total em {selectedMonth}</p>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                    {formatCurrency(vehicleStats.carTotal)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(vehicleStats.carFuel)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Manutenção</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(vehicleStats.carMaint)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Lançamentos Recentes</h4>
                    {data.vehicleExpenses
                      .filter(e => e.month === selectedMonth && e.year === selectedYear && e.type === "Carro")
                      .map(e => (
                        <div key={e.id} className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <div className="flex flex-col">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{e.description}</span>
                            <span className="text-[10px] text-slate-400">{e.category}</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(e.value)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600">
                      <Bike size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold">Gastos com Moto</h3>
                      <p className="text-sm text-slate-500">Total em {selectedMonth}</p>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                    {formatCurrency(vehicleStats.motoTotal)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(vehicleStats.motoFuel)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Manutenção</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(vehicleStats.motoMaint)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Lançamentos Recentes</h4>
                    {data.vehicleExpenses
                      .filter(e => e.month === selectedMonth && e.year === selectedYear && e.type === "Moto")
                      .map(e => (
                        <div key={e.id} className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <div className="flex flex-col">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{e.description}</span>
                            <span className="text-[10px] text-slate-400">{e.category}</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(e.value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "loans" && (
            <motion.div
              key="loans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {activeLoans.map((loan) => (
                <div key={loan.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400">
                      <AlertCircle size={20} />
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      loan.paidInstallments === loan.installments ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {loan.paidInstallments === loan.installments ? "Quitado" : "Em Aberto"}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">{loan.description}</h4>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs text-slate-500">Parcela: {formatCurrency(loan.installmentValue)}</p>
                    {loan.endMonth && (
                      <p className="text-[10px] text-emerald-600 font-medium">Quitado em: {loan.endMonth}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progresso</span>
                      <span>{loan.paidInstallments}/{loan.installments}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-500" 
                        style={{ width: `${(loan.paidInstallments / loan.installments) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Valor Total</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(loan.totalValue)}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleEditLoan(loan)}
                      className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                    {loan.paidInstallments < loan.installments && (
                      <button 
                        onClick={() => payOffLoan(loan.id)}
                        className="flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Save size={20} className="text-blue-600" />
                    Backup de Dados
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">Exporte seus dados para um arquivo JSON ou importe um backup existente.</p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={exportToJson}
                      className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all"
                    >
                      <Download size={20} />
                      Exportar JSON
                    </button>
                    <label className="flex items-center justify-center gap-2 w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold transition-all cursor-pointer">
                      <Upload size={20} />
                      Importar JSON
                      <input type="file" accept=".json" onChange={importFromJson} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Relatórios
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">Gere um relatório anual detalhado em PDF com todos os dados de {selectedYear}.</p>
                  <button 
                    onClick={generatePDF}
                    className="flex items-center justify-center gap-2 w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    <FileText size={20} />
                    Gerar Relatório Anual PDF
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/30 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-rose-600">
                    <AlertCircle size={20} />
                    Zona de Perigo
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">Apague todos os dados salvos localmente. Esta ação não pode ser desfeita.</p>
                  <button 
                    onClick={() => {
                      if (confirm("Tem certeza que deseja apagar TODOS os dados? Esta ação é irreversível.")) {
                        localStorage.removeItem("finance_data_v3");
                        setData(INITIAL_DATA);
                        setSelectedMonth("");
                        setSelectedYear(2026);
                        alert("Todos os dados foram apagados.");
                      }
                    }}
                    className="flex items-center justify-center gap-2 w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 py-3 rounded-xl font-bold transition-all"
                  >
                    <X size={20} />
                    Apagar Tudo
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingLoan ? "Editar Empréstimo" : "Novo Lançamento"}</h3>
                <button onClick={() => { setIsAddModalOpen(false); setEditingLoan(null); }} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <AddEntryForm 
                onAdd={handleAddEntry} 
                months={data.months.map(m => m.month)} 
                initialLoan={editingLoan}
                selectedYear={selectedYear}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnnualPdfReportTemplate({ data, year }: { data: FinanceData, year: number }) {
  const filteredData = useMemo(() => {
    return {
      ...data,
      months: data.months.filter(m => m.year === year),
      loans: data.loans.filter(l => l.year === year),
      vehicleExpenses: data.vehicleExpenses.filter(e => e.year === year),
      savings: data.savings.filter(s => s.year === year),
      categorizedExpenses: data.categorizedExpenses.filter(e => e.year === year),
      investments: data.investments?.filter(i => i.year === year) || [],
      loanPayments: data.loanPayments?.filter(p => p.year === year) || []
    };
  }, [data, year]);
  
  const totals = useMemo(() => {
    let baseIncome = 0;
    let totalFixedExpenses = 0;
    
    filteredData.months.forEach(m => {
      baseIncome += Object.values(m.income || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
      totalFixedExpenses += Object.values(m.expenses || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
    });

    const totalLoanIncome = filteredData.loans.reduce((a, b) => a + b.totalValue, 0);
    const totalLoanPayments = filteredData.loanPayments?.reduce((a, b) => a + b.value, 0) || 0;
    const totalIncome = baseIncome + totalLoanIncome;
    
    const totalCategorized = filteredData.categorizedExpenses.reduce((a, b) => a + b.value, 0);
    const totalVehicle = filteredData.vehicleExpenses.reduce((a, b) => a + b.value, 0);
    const totalSavings = filteredData.savings.reduce((a, b) => a + b.value, 0);
    const totalInvestments = filteredData.investments?.reduce((a, b) => a + b.value, 0) || 0;
    
    const totalExpenses = totalFixedExpenses + totalLoanPayments;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      balance: totalIncome - totalExpenses - totalInvestments,
      savings: totalSavings,
      investments: totalInvestments,
      fixed: totalFixedExpenses,
      categorized: totalCategorized,
      vehicle: totalVehicle,
      loanPayments: totalLoanPayments
    };
  }, [filteredData]);

  const annualIncomeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredData.months.forEach(m => {
      Object.entries(m.income || {}).forEach(([key, value]) => {
        breakdown[key] = (breakdown[key] || 0) + (value as number);
      });
    });
    
    const totalLoanIncome = filteredData.loans.reduce((a, b) => a + b.totalValue, 0);
    if (totalLoanIncome > 0) {
      breakdown["Empréstimos Recebidos"] = totalLoanIncome;
    }
    
    return Object.entries(breakdown);
  }, [filteredData]);

  const annualFixedBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredData.months.forEach(m => {
      Object.entries(m.expenses || {}).forEach(([key, value]) => {
        breakdown[key] = (breakdown[key] || 0) + (value as number);
      });
    });
    
    if (totals.loanPayments > 0) {
      breakdown["Pagamento de Empréstimos"] = totals.loanPayments;
    }

    return Object.entries(breakdown);
  }, [filteredData, totals.loanPayments]);

  const annualCategorizedBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredData.categorizedExpenses.forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.value;
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  const activeLoans = useMemo(() => {
    const loansInYear = data.loans.filter(l => l.year === year);
    const loansWithPaymentsInYear = data.loans.filter(l => 
      data.loanPayments?.some(p => p.loanId === l.id && p.year === year)
    );
    const combined = Array.from(new Set([...loansInYear, ...loansWithPaymentsInYear]));
    return combined;
  }, [data.loans, data.loanPayments, year]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-600">Relatório Financeiro Anual</h1>
          <p className="text-slate-500 text-lg">Ano Base: {year}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500">Gerado em:</p>
          <p className="text-sm">{new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Resumo Anual */}
      <div className="grid grid-cols-5 gap-4">
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Renda Anual</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totals.income)}</p>
        </div>
        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
          <p className="text-xs font-bold text-rose-600 uppercase mb-1">Gastos Anuais</p>
          <p className="text-xl font-bold text-rose-700">{formatCurrency(totals.expenses)}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-600 uppercase mb-1">Investimentos</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totals.investments)}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-bold text-blue-600 uppercase mb-1">Saldo Acumulado</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totals.balance)}</p>
        </div>
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Economias</p>
          <p className="text-xl font-bold text-indigo-700">{formatCurrency(totals.savings)}</p>
        </div>
      </div>

      {/* Tabela Mensal */}
      <section>
        <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Resumo por Mês</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Mês</th>
              <th className="px-4 py-2 text-right">Renda</th>
              <th className="px-4 py-2 text-right">Gastos Fixos</th>
              <th className="px-4 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.months.map(m => {
              const baseIncome = Object.values(m.income || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
              const mLoanIncome = data.loans.filter(l => l.month === m.month).reduce((a, b) => a + b.totalValue, 0);
              const mLoanPayments = data.loanPayments?.filter(p => p.month === m.month).reduce((a, b) => a + b.value, 0) || 0;
              const mIncome = baseIncome + mLoanIncome - mLoanPayments;
              
              const mFixed = Object.values(m.expenses || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;
              const mInv = data.investments?.filter(i => i.month === m.month).reduce((a, b) => a + b.value, 0) || 0;
              const mTotalExp = mFixed;
              return (
                <tr key={m.month}>
                  <td className="px-4 py-2 font-medium">{m.month}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(mIncome)}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(mFixed)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(mIncome - mTotalExp - mInv)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-2 gap-8">
        {/* Detalhamento de Renda Anual */}
        <section>
          <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Renda Anual por Fonte</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {annualIncomeBreakdown.map(([key, value]) => (
                <tr key={key}>
                  <td className="py-2 text-slate-600 capitalize">{key}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Contas Fixas Anuais */}
        <section>
          <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Contas Fixas Anuais</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {annualFixedBreakdown.map(([key, value]) => (
                <tr key={key}>
                  <td className="py-2 text-slate-600 capitalize">{key}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Detalhamento de Investimentos */}
        <section className="col-span-2">
          <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Investimentos Realizados</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {data.investments?.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2 text-slate-600">{inv.description} ({inv.month})</td>
                  <td className="py-2 text-right font-medium text-amber-600">{formatCurrency(inv.value)}</td>
                </tr>
              ))}
              {(!data.investments || data.investments.length === 0) && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-slate-400 italic">Nenhum investimento registrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Gastos Variáveis por Categoria */}
      <section>
        <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Gastos Variáveis por Categoria (Ano)</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Categoria</th>
              <th className="px-4 py-2 text-right">Total Acumulado</th>
              <th className="px-4 py-2 text-right">% do Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {annualCategorizedBreakdown.map(([name, value]) => (
              <tr key={name}>
                <td className="px-4 py-2 font-medium">{name}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(value)}</td>
                <td className="px-4 py-2 text-right text-slate-500">
                  {((value / totals.categorized) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Gastos com Veículos */}
      <section>
        <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Gastos com Veículos (Ano)</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Veículo</th>
              <th className="px-4 py-2 text-right">Combustível</th>
              <th className="px-4 py-2 text-right">Manutenção</th>
              <th className="px-4 py-2 text-right">Total Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {['Carro', 'Moto'].map(type => {
              const fuel = data.vehicleExpenses
                .filter(e => e.type === type && e.category === "Combustível")
                .reduce((acc, e) => acc + e.value, 0);
              const maint = data.vehicleExpenses
                .filter(e => e.type === type && e.category === "Manutenção")
                .reduce((acc, e) => acc + e.value, 0);
              const total = fuel + maint;
              return (
                <tr key={type}>
                  <td className="px-4 py-2 font-medium">{type}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(fuel)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(maint)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Empréstimos */}
      <section>
        <h2 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Situação de Empréstimos</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Descrição</th>
              <th className="px-4 py-2 text-center">Parcelas</th>
              <th className="px-4 py-2 text-center">Quitação</th>
              <th className="px-4 py-2 text-right">Valor Total</th>
              <th className="px-4 py-2 text-right">Restante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeLoans.map(l => (
              <tr key={l.id}>
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-center">{l.paidInstallments}/{l.installments}</td>
                <td className="px-4 py-2 text-center text-slate-500">{l.endMonth || '-'}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(l.totalValue)}</td>
                <td className="px-4 py-2 text-right font-medium text-rose-600">
                  {formatCurrency((l.installments - l.paidInstallments) * l.installmentValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="pt-8 text-center text-xs text-slate-400 border-t border-slate-100">
        <p>FinAnalyzer - Seu controle financeiro pessoal anual</p>
      </div>
    </div>
  );
}

function Card({ title, value, icon: Icon, color, bgColor, trend }: any) {
  const isPercentage = typeof trend === 'string' && (trend.includes('%') || trend === "0%");
  const isPositive = isPercentage && trend.startsWith('+');
  const isNegative = isPercentage && trend.startsWith('-');

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor, color)}>
          <Icon size={24} />
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
          isPercentage 
            ? (isPositive ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : isNegative ? "text-rose-600 bg-rose-50 dark:bg-rose-900/20" : "text-slate-500 bg-slate-50 dark:bg-slate-800/20")
            : "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
        )}>
          {isPercentage && isPositive && <ArrowUpRight size={12} />}
          {isPercentage && isNegative && <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(value)}</h3>
    </div>
  );
}

function AddEntryForm({ onAdd, months, initialLoan, selectedYear }: { onAdd: (type: string, entry: any) => void, months: string[], initialLoan?: Loan | null, selectedYear: number }) {
  const [type, setType] = useState<"expense" | "month" | "vehicle" | "loan" | "income" | "fixed_expense" | "investment">(initialLoan ? "loan" : "expense");
  const [formData, setFormData] = useState<any>({
    description: initialLoan?.description || "",
    value: initialLoan?.installmentValue.toString() || "",
    category: "Outros",
    month: initialLoan?.month || months[months.length - 1] || "",
    year: initialLoan?.year || selectedYear,
    type: "Carro",
    field: "salario", // for income/fixed_expense
    installments: initialLoan?.installments.toString() || "1",
    paidInstallments: initialLoan?.paidInstallments.toString() || "0",
    endMonth: initialLoan?.endMonth || ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(formData.value) || 0;
    const inst = parseInt(formData.installments) || 1;
    const paid = parseInt(formData.paidInstallments) || 0;
    
    const entry = {
      id: initialLoan?.id || Math.random().toString(36).substr(2, 9),
      ...formData,
      value: val,
      installments: inst,
      paidInstallments: paid,
      installmentValue: type === "loan" ? val : undefined,
      totalValue: type === "loan" ? val * inst : undefined,
    };
    onAdd(type, entry);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Tipo de Lançamento</label>
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as any)}
          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
        >
          <option value="income">Ganhos (Salário/Bônus)</option>
          <option value="fixed_expense">Contas Fixas (Cartões/Água/Luz)</option>
          <option value="expense">Gasto Variável (Mercado/Lazer)</option>
          <option value="vehicle">Gasto Veículo (Combustível/Peças)</option>
          <option value="investment">Investimento</option>
          <option value="loan">Novo Empréstimo</option>
          <option value="month">Novo Mês</option>
        </select>
      </div>

      {type !== "month" && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Mês</label>
            <select 
              value={formData.month}
              onChange={(e) => setFormData({...formData, month: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Ano</label>
            <input 
              type="number" 
              required
              value={formData.year}
              onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Valor (R$)</label>
            <input 
              type="number" 
              required
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {type === "income" && (
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Tipo de Ganho</label>
          <select 
            value={formData.field}
            onChange={(e) => setFormData({...formData, field: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
          >
            <option value="salario">Salário</option>
            <option value="bonus">Bônus</option>
            <option value="outros">Outros</option>
          </select>
        </div>
      )}

      {type === "fixed_expense" && (
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Tipo de Conta</label>
          <select 
            value={formData.field}
            onChange={(e) => setFormData({...formData, field: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
          >
            <option value="inter">Cartão Inter</option>
            <option value="nubank">Cartão Nubank</option>
            <option value="mPago">Mercado Pago</option>
            <option value="agua">Água</option>
            <option value="energia">Energia</option>
            <option value="pix">Pix</option>
            <option value="outros">Outros</option>
          </select>
        </div>
      )}

      {type === "expense" && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Descrição</label>
            <input 
              type="text" 
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              placeholder="Ex: Corte de cabelo, Pedágio..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Categoria</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            >
              <option value="Alimentação">Alimentação</option>
              <option value="Saúde">Saúde</option>
              <option value="Transporte">Transporte</option>
              <option value="Lazer">Lazer</option>
              <option value="Assinaturas">Assinaturas</option>
              <option value="Presentes">Presentes</option>
              <option value="Vestuário">Vestuário</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        </>
      )}

      {type === "vehicle" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Veículo</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              >
                <option value="Carro">Carro</option>
                <option value="Moto">Moto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Categoria</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              >
                <option value="Combustível">Combustível</option>
                <option value="Manutenção">Manutenção/Peças</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Descrição</label>
            <input 
              type="text" 
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              placeholder="Ex: Troca de óleo, Abastecimento..."
            />
          </div>
        </>
      )}

      {type === "investment" && (
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Descrição do Investimento</label>
          <input 
            type="text" 
            required
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            placeholder="Ex: Tesouro Direto, Ações..."
          />
        </div>
      )}

      {type === "loan" && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Descrição do Empréstimo</label>
            <input 
              type="text" 
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              placeholder="Ex: Empréstimo Banco X"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Valor da Parcela (R$)</label>
              <input 
                type="number" 
                step="0.01"
                required
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Total de Parcelas</label>
              <input 
                type="number" 
                value={formData.installments}
                onChange={(e) => setFormData({...formData, installments: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Parcelas Pagas</label>
              <input 
                type="number" 
                value={formData.paidInstallments}
                onChange={(e) => setFormData({...formData, paidInstallments: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Mês de Término (Opcional)</label>
              <select 
                value={formData.endMonth}
                onChange={(e) => setFormData({...formData, endMonth: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Nenhum</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </>
      )}

      {type === "month" && (
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Nome do Mês (Ex: Abril)" 
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            onChange={(e) => setFormData({...formData, month: e.target.value})}
          />
          <input 
            type="number" 
            placeholder="Ano (Ex: 2026)" 
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
          />
        </div>
      )}

      <button 
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all mt-4"
      >
        Salvar Lançamento
      </button>
    </form>
  );
}
