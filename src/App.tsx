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
import { FinanceData, MonthData, CategorizedExpense, VehicleExpense, Loan } from "./types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function App() {
  const [data, setData] = useState<FinanceData>(() => {
    const saved = localStorage.getItem("finance_data");
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "vehicles" | "loans" | "settings">("overview");
  const [selectedMonth, setSelectedMonth] = useState<string>(data.months[data.months.length - 1]?.month || "");
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("finance_data", JSON.stringify(data));
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
    const monthData = data.months.find(m => m.month === selectedMonth);
    const monthSavings = data.savings.filter(s => s.month === selectedMonth).reduce((a, b) => a + (b.value as number), 0);
    
    if (!monthData) return { income: 0, expenses: 0, balance: 0, savings: monthSavings };

    const totalIncome = Object.values(monthData.income).reduce((a, b) => (a as number) + (b as number), 0) as number;
    const totalExpenses = Object.values(monthData.expenses).reduce((a, b) => (a as number) + (b as number), 0) as number;
    
    return {
      income: totalIncome,
      expenses: totalExpenses,
      balance: totalIncome - totalExpenses,
      savings: monthSavings
    };
  }, [selectedMonth, data]);

  const chartData = useMemo(() => {
    return data.months.map(m => {
      const totalIncome = Object.values(m.income).reduce((a, b) => (a as number) + (b as number), 0) as number;
      const totalExpenses = Object.values(m.expenses).reduce((a, b) => (a as number) + (b as number), 0) as number;
      return {
        name: m.month,
        Renda: totalIncome,
        Gastos: totalExpenses,
        Saldo: totalIncome - totalExpenses
      };
    });
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    const expenses = data.categorizedExpenses.filter(e => e.month === selectedMonth);
    const grouped = expenses.reduce((acc: any, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.value;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value: value as number }));
  }, [selectedMonth, data]);

  const vehicleStats = useMemo(() => {
    const expenses = data.vehicleExpenses.filter(e => e.month === selectedMonth);
    const carTotal = expenses.filter(e => e.type === "Carro").reduce((a, b) => a + b.value, 0);
    const motoTotal = expenses.filter(e => e.type === "Moto").reduce((a, b) => a + b.value, 0);
    return { carTotal, motoTotal };
  }, [selectedMonth, data]);

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
      pdf.save(`relatorio_financeiro_anual_${data.months[0]?.year || 2026}.pdf`);
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
          if (m.month === entry.month) {
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
      } else if (type === "loan") {
        newData.loans = [...newData.loans, entry];
      }
      
      return newData;
    });
    setIsAddModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* PDF Report Template (Hidden) */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, height: 0, overflow: "hidden" }}>
        <div ref={pdfRef} className="p-8 bg-white text-slate-900 w-[210mm] pdf-report">
          <AnnualPdfReportTemplate data={data} />
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
            <p className="text-slate-500 dark:text-slate-400">Acompanhe sua saúde financeira de 2026</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm self-start">
              {data.months.map(m => (
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
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card 
                  title="Renda Total" 
                  value={stats.income} 
                  icon={TrendingUp} 
                  color="text-emerald-600" 
                  bgColor="bg-emerald-50 dark:bg-emerald-900/20"
                  trend="+12%"
                />
                <Card 
                  title="Gastos Totais" 
                  value={stats.expenses} 
                  icon={TrendingDown} 
                  color="text-rose-600" 
                  bgColor="bg-rose-50 dark:bg-rose-900/20"
                  trend="+5%"
                />
                <Card 
                  title="Saldo Final" 
                  value={stats.balance} 
                  icon={Wallet} 
                  color="text-blue-600" 
                  bgColor="bg-blue-50 dark:bg-blue-900/20"
                  trend="Saudável"
                />
                <Card 
                  title="Economias" 
                  value={stats.savings} 
                  icon={PiggyBank} 
                  color="text-amber-600" 
                  bgColor="bg-amber-50 dark:bg-amber-900/20"
                  trend="Investido"
                />
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
                  <span className="text-sm text-slate-500">{data.categorizedExpenses.filter(e => e.month === selectedMonth).length} transações</span>
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
                        .filter(e => e.month === selectedMonth)
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
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                    {formatCurrency(vehicleStats.carTotal)}
                  </div>
                  <div className="space-y-3">
                    {data.vehicleExpenses
                      .filter(e => e.month === selectedMonth && e.type === "Carro")
                      .map(e => (
                        <div key={e.id} className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span className="text-slate-600 dark:text-slate-400">{e.description}</span>
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
                  <div className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                    {formatCurrency(vehicleStats.motoTotal)}
                  </div>
                  <div className="space-y-3">
                    {data.vehicleExpenses
                      .filter(e => e.month === selectedMonth && e.type === "Moto")
                      .map(e => (
                        <div key={e.id} className="flex items-center justify-between text-sm p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <span className="text-slate-600 dark:text-slate-400">{e.description}</span>
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
              {data.loans.map((loan) => (
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
                  <p className="text-xs text-slate-500 mb-4">Parcela: {formatCurrency(loan.installmentValue)}</p>
                  
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
                  <p className="text-sm text-slate-500 mb-6">Gere um relatório anual detalhado em PDF com todos os dados de {data.months[0]?.year || 2026}.</p>
                  <button 
                    onClick={generatePDF}
                    className="flex items-center justify-center gap-2 w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white py-3 rounded-xl font-bold transition-all"
                  >
                    <FileText size={20} />
                    Gerar Relatório Anual PDF
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
                <h3 className="text-xl font-bold">Novo Lançamento</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <AddEntryForm onAdd={handleAddEntry} months={data.months.map(m => m.month)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnnualPdfReportTemplate({ data }: { data: FinanceData }) {
  const year = data.months[0]?.year || 2026;
  
  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalFixedExpenses = 0;
    
    data.months.forEach(m => {
      totalIncome += Object.values(m.income).reduce((a, b) => (a as number) + (b as number), 0) as number;
      totalFixedExpenses += Object.values(m.expenses).reduce((a, b) => (a as number) + (b as number), 0) as number;
    });

    const totalCategorized = data.categorizedExpenses.reduce((a, b) => a + b.value, 0);
    const totalVehicle = data.vehicleExpenses.reduce((a, b) => a + b.value, 0);
    const totalSavings = data.savings.reduce((a, b) => a + b.value, 0);
    
    const totalExpenses = totalFixedExpenses + totalCategorized + totalVehicle;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      balance: totalIncome - totalExpenses,
      savings: totalSavings,
      fixed: totalFixedExpenses,
      categorized: totalCategorized,
      vehicle: totalVehicle
    };
  }, [data]);

  const annualIncomeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    data.months.forEach(m => {
      Object.entries(m.income).forEach(([key, value]) => {
        breakdown[key] = (breakdown[key] || 0) + (value as number);
      });
    });
    return Object.entries(breakdown);
  }, [data]);

  const annualFixedBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    data.months.forEach(m => {
      Object.entries(m.expenses).forEach(([key, value]) => {
        breakdown[key] = (breakdown[key] || 0) + (value as number);
      });
    });
    return Object.entries(breakdown);
  }, [data]);

  const annualCategorizedBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    data.categorizedExpenses.forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.value;
    });
    return Object.entries(breakdown);
  }, [data]);

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
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Renda Anual</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totals.income)}</p>
        </div>
        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
          <p className="text-xs font-bold text-rose-600 uppercase mb-1">Gastos Anuais</p>
          <p className="text-xl font-bold text-rose-700">{formatCurrency(totals.expenses)}</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs font-bold text-blue-600 uppercase mb-1">Saldo Acumulado</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totals.balance)}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-600 uppercase mb-1">Total Economias</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totals.savings)}</p>
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
              <th className="px-4 py-2 text-right">Gastos Variáveis</th>
              <th className="px-4 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.months.map(m => {
              const mIncome = Object.values(m.income).reduce((a, b) => (a as number) + (b as number), 0) as number;
              const mFixed = Object.values(m.expenses).reduce((a, b) => (a as number) + (b as number), 0) as number;
              const mVar = data.categorizedExpenses.filter(e => e.month === m.month).reduce((a, b) => a + b.value, 0);
              const mVeh = data.vehicleExpenses.filter(e => e.month === m.month).reduce((a, b) => a + b.value, 0);
              const mTotalExp = mFixed + mVar + mVeh;
              return (
                <tr key={m.month}>
                  <td className="px-4 py-2 font-medium">{m.month}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(mIncome)}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(mFixed)}</td>
                  <td className="px-4 py-2 text-right text-rose-600">{formatCurrency(mVar + mVeh)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(mIncome - mTotalExp)}</td>
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
              <th className="px-4 py-2 text-left">Categoria</th>
              <th className="px-4 py-2 text-right">Total Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {['Carro', 'Moto'].map(type => {
              const total = data.vehicleExpenses
                .filter(e => e.type === type)
                .reduce((acc, e) => acc + e.value, 0);
              return (
                <tr key={type}>
                  <td className="px-4 py-2 font-medium">{type}</td>
                  <td className="px-4 py-2 text-slate-500">Combustível / Manutenção</td>
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
              <th className="px-4 py-2 text-right">Valor Total</th>
              <th className="px-4 py-2 text-right">Restante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.loans.map(l => (
              <tr key={l.id}>
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-center">{l.paidInstallments}/{l.installments}</td>
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
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor, color)}>
          <Icon size={24} />
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
          <ArrowUpRight size={14} />
          {trend}
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(value)}</h3>
    </div>
  );
}

function AddEntryForm({ onAdd, months }: { onAdd: (type: string, entry: any) => void, months: string[] }) {
  const [type, setType] = useState<"expense" | "month" | "vehicle" | "loan" | "income" | "fixed_expense">("expense");
  const [formData, setFormData] = useState<any>({
    description: "",
    value: "",
    category: "Outros",
    month: months[months.length - 1] || "",
    type: "Carro",
    field: "salario", // for income/fixed_expense
    installments: "1",
    paidInstallments: "0",
    endMonth: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      value: parseFloat(formData.value) || 0,
      installments: parseInt(formData.installments) || 1,
      paidInstallments: parseInt(formData.paidInstallments) || 0,
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
          <option value="loan">Novo Empréstimo</option>
          <option value="month">Novo Mês</option>
        </select>
      </div>

      {type !== "month" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Mês Referência</label>
            <select 
              value={formData.month}
              onChange={(e) => setFormData({...formData, month: e.target.value})}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
            >
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
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
              <label className="block text-sm font-medium text-slate-500 mb-1">Total de Parcelas</label>
              <input 
                type="number" 
                value={formData.installments}
                onChange={(e) => setFormData({...formData, installments: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Parcelas Pagas</label>
              <input 
                type="number" 
                value={formData.paidInstallments}
                onChange={(e) => setFormData({...formData, paidInstallments: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-600"
              />
            </div>
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
