import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  LayoutList, 
  LayoutGrid, 
  Users, 
  LogOut,
  ArrowUpCircle,
  ArrowDownCircle,
  MoreHorizontal,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';

// --- MOCK DATA ---

const lineChartData = [
  { name: 'Nov 24', cns: 120, cancer: 80, pain: 140, glp1: 90 },
  { name: 'Dec 24', cns: 150, cancer: 100, pain: 150, glp1: 95 },
  { name: 'Jan 25', cns: 165, cancer: 120, pain: 160, glp1: 105 },
  { name: 'Mar 25', cns: 185, cancer: 150, pain: 175, glp1: 105 },
  { name: 'Apr 25', cns: 200, cancer: 160, pain: 180, glp1: 105 },
  { name: 'May 25', cns: 230, cancer: 190, pain: 195, glp1: 110 },
  { name: 'Jun 25', cns: 250, cancer: 205, pain: 210, glp1: 110 },
  { name: 'Jul 25', cns: 280, cancer: 230, pain: 215, glp1: 110 },
  { name: 'Aug 25', cns: 310, cancer: 260, pain: 220, glp1: 115 },
  { name: 'Sep 25', cns: 350, cancer: 320, pain: 245, glp1: 125 },
];

const innerPieData = [
  { name: 'Cancer Med', value: 25, color: '#10b981' }, // emerald
  { name: 'GLP-1', value: 25, color: '#3b82f6' }, // blue
  { name: 'Pain Med', value: 25, color: '#f59e0b' }, // amber
  { name: 'CNS Med', value: 25, color: '#a855f7' }, // purple
];

const outerPieData = [
  // Cancer Med
  { name: 'Ca1', value: 5, color: '#059669' },
  { name: 'Ca2', value: 5, color: '#34d399' },
  { name: 'Ca3', value: 5, color: '#059669' },
  { name: 'Ca4', value: 5, color: '#34d399' },
  { name: 'Ca5', value: 5, color: '#059669' },
  // GLP-1
  { name: 'Oz...', value: 6, color: '#2563eb' },
  { name: 'We...', value: 5, color: '#60a5fa' },
  { name: 'Ad...', value: 5, color: '#2563eb' },
  { name: 'By...', value: 4, color: '#60a5fa' },
  { name: 'Ox...', value: 5, color: '#2563eb' },
  // Pain Med
  { name: 'Hy...', value: 5, color: '#d97706' },
  { name: 'Ox...', value: 5, color: '#fbbf24' },
  { name: 'Co...', value: 5, color: '#d97706' },
  { name: 'Ta...', value: 5, color: '#fbbf24' },
  { name: 'Ri...', value: 5, color: '#d97706' },
  // CNS Med
  { name: 'At...', value: 5, color: '#9333ea' },
  { name: 'Ki...', value: 5, color: '#c084fc' },
  { name: 'Val...', value: 5, color: '#9333ea' },
  { name: 'Bu...', value: 5, color: '#c084fc' },
  { name: 'Im...', value: 5, color: '#9333ea' },
];

const topDrugs = [
  { name: 'Mounjaro', total: '1,597', trend: '-2.4%', isUp: false, colorClass: 'bg-[#a7f3d0] text-emerald-900' },
  { name: 'Ozempic', total: '1,150', trend: '-1.6%', isUp: false, colorClass: 'bg-[#bfdbfe] text-blue-900' },
  { name: 'Wegovy', total: '1,789', trend: '0.7%', isUp: true, colorClass: 'bg-[#fde68a] text-amber-900' },
  { name: 'Rybelsus', total: '1,705', trend: '4.6%', isUp: true, colorClass: 'bg-[#e9d5ff] text-purple-900' },
  { name: 'Trulicity', total: '1,730', trend: '-2.0%', isUp: false, colorClass: 'bg-[#a5f3fc] text-cyan-900' },
];

// Custom Axis Tick for Line Chart
const CustomXAxisTick = ({ x, y, payload }) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-45)" fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

export default function App() {
  const [activeNav, setActiveNav] = useState('Top Products');

  return (
    <div className="flex h-screen bg-[#f3f7f9] font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a1116] text-white flex flex-col justify-between shadow-xl z-20">
        <div>
          {/* Logo Area */}
          <div className="h-14 flex items-center px-4 py-2 bg-[#050a0d]">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-600 text-white text-xs font-bold px-1 py-0.5 rounded">ASOP</div>
              <div className="text-xs text-gray-400 border-l border-gray-600 pl-2 leading-tight">
                ALLIANCE FOR SAFE<br/>ONLINE PHARMACIES
              </div>
              <div className="text-sm font-bold border-l border-gray-600 pl-2 text-white">
                S-3<br/>
                <span className="text-xs font-normal text-gray-400">Research</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-6 px-3 space-y-1">
            <button 
              onClick={() => setActiveNav('Top Products')}
              className={`w-full flex flex-col items-start px-3 py-2.5 rounded-lg transition-colors ${
                activeNav === 'Top Products' ? 'bg-[#98b8c8] text-gray-900' : 'text-gray-300 hover:bg-[#1a252c]'
              }`}
            >
              <div className="flex items-center space-x-3 font-semibold">
                <LayoutList size={18} className={activeNav === 'Top Products' ? 'text-gray-900' : 'text-gray-400'} />
                <span>Top Products</span>
              </div>
              <span className={`text-xs ml-7 mt-0.5 ${activeNav === 'Top Products' ? 'text-gray-700' : 'text-gray-500'}`}>Trending Products</span>
            </button>

            <button 
              onClick={() => setActiveNav('Domain Insights')}
              className={`w-full flex flex-col items-start px-3 py-2.5 rounded-lg transition-colors ${
                activeNav === 'Domain Insights' ? 'bg-[#98b8c8] text-gray-900' : 'text-gray-300 hover:bg-[#1a252c]'
              }`}
            >
              <div className="flex items-center space-x-3 font-semibold">
                <LayoutGrid size={18} className="text-gray-400" />
                <span>Domain Insights</span>
              </div>
              <span className="text-xs ml-7 mt-0.5 text-gray-500">Website trends</span>
            </button>

            <button 
              onClick={() => setActiveNav('Social-media Insights')}
              className={`w-full flex flex-col items-start px-3 py-2.5 rounded-lg transition-colors ${
                activeNav === 'Social-media Insights' ? 'bg-[#98b8c8] text-gray-900' : 'text-gray-300 hover:bg-[#1a252c]'
              }`}
            >
              <div className="flex items-center space-x-3 font-semibold">
                <Users size={18} className="text-gray-400" />
                <span>Social-media Insights</span>
              </div>
              <span className="text-xs ml-7 mt-0.5 text-gray-500">Platform-wise Statistics</span>
            </button>
          </nav>
        </div>

        {/* User Profile */}
        <div className="p-4 mb-2 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-sm font-bold">
            M
          </div>
          <div>
            <div className="text-sm font-medium">Mingxiang Cai</div>
            <div className="text-xs text-gray-400">m.cai@s-3.io</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER */}
        <header className="h-14 bg-[#0a1116] flex items-center justify-end px-6 text-sm text-gray-300 shadow-md z-10">
          <div className="flex items-center space-x-6">
            <button className="hover:text-white transition-colors">Home</button>
            <button className="hover:text-white transition-colors flex items-center">
              App <ChevronLeft size={14} className="ml-1 -rotate-90" />
            </button>
            <button className="hover:text-white transition-colors pl-2">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* DASHBOARD SCROLLABLE AREA */}
        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-12 gap-6 max-w-[1600px] mx-auto">
            
            {/* LEFT COLUMN - TEAL CARDS */}
            <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col">
              
              {/* Top Category Card */}
              <div className="bg-[#1f4e58] rounded-xl p-5 text-white shadow-sm border border-[#2d6470]">
                <h2 className="text-xl font-bold mb-6">Top Category: GLP-1</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-[#9cd3e0] mb-1">Online Listings</div>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-bold">1,000</span>
                      <span className="flex items-center text-xs font-semibold bg-white text-emerald-700 px-1.5 py-0.5 rounded shadow-sm">
                        <ArrowUpRight size={12} className="mr-0.5" /> 8.1%
                      </span>
                    </div>
                    <div className="text-xs text-[#9cd3e0] mt-1 opacity-80">Since last month</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#9cd3e0] mb-1">Social Media Listings</div>
                    <div className="flex items-baseline space-x-3">
                      <span className="text-3xl font-bold">500</span>
                      <span className="flex items-center text-xs font-semibold bg-white text-emerald-700 px-1.5 py-0.5 rounded shadow-sm">
                        <ArrowUpRight size={12} className="mr-0.5" /> 4.5%
                      </span>
                    </div>
                    <div className="text-xs text-[#9cd3e0] mt-1 opacity-80">Since last month</div>
                  </div>
                </div>
              </div>

              {/* Top GLP-1 Drugs List Card */}
              <div className="bg-[#1f4e58] rounded-xl flex-1 flex flex-col shadow-sm border border-[#2d6470] overflow-hidden relative">
                <div className="p-5 pb-3">
                  <h3 className="text-lg font-bold text-white mb-4">Top GLP-1 Drugs</h3>
                </div>
                
                {/* Scrollable List Container (if it gets long) */}
                <div className="px-5 pb-5 flex-1 overflow-auto">
                  <div className="space-y-[22px]">
                    {topDrugs.map((drug, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="w-1/3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${drug.colorClass}`}>
                            {drug.name}
                          </span>
                        </div>
                        
                        <div className="w-1/3 text-center">
                          <div className="text-white font-semibold text-[15px]">{drug.total}</div>
                          <div className="text-[#9cd3e0] text-xs opacity-80">total listings</div>
                        </div>

                        <div className="w-1/3 flex items-center justify-end space-x-2">
                          <span className="text-white text-sm font-medium">{drug.trend}</span>
                          {drug.isUp ? (
                            <ArrowUpCircle size={18} className="text-emerald-400 bg-white rounded-full p-[1px]" fill="currentColor" />
                          ) : (
                            <ArrowDownCircle size={18} className="text-red-400 bg-white rounded-full p-[1px]" fill="currentColor" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Scrollbar decorative element (from screenshot) */}
                <div className="absolute right-1 top-16 bottom-16 w-1.5 bg-white/20 rounded-full"></div>
              </div>

              {/* Alerts Card */}
              <div className="bg-[#1f4e58] rounded-xl shadow-sm border border-[#2d6470] overflow-hidden text-white flex flex-col">
                <div className="p-4 flex items-center justify-between border-b border-white/10">
                  <h3 className="text-lg font-bold">Alerts</h3>
                  <button className="flex items-center space-x-1 border border-white/30 rounded px-3 py-1 text-sm hover:bg-white/10 transition">
                    <Plus size={14} /> <span>Create</span>
                  </button>
                </div>
                
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#183d46] text-xs font-semibold text-[#9cd3e0]">
                  <div className="col-span-2">Enabl...</div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">Frequency</div>
                  <div className="col-span-5">Description</div>
                </div>

                {/* Table Row */}
                <div className="grid grid-cols-12 gap-4 px-4 py-4 items-center text-sm border-b border-white/5">
                  <div className="col-span-2 flex items-center pl-2">
                    <Check size={16} className="text-emerald-400" />
                  </div>
                  <div className="col-span-3 font-medium truncate pr-2" title="GLP-1 Total Volume Threshold">
                    GLP-1 Total Volume Threshold
                  </div>
                  <div className="col-span-2">
                    <span className="inline-block bg-[#86efac] text-emerald-900 text-xs px-2 py-0.5 rounded font-bold truncate max-w-[60px]">
                      Mont...
                    </span>
                  </div>
                  <div className="col-span-5 text-xs text-white/90 leading-tight">
                    Trigger if GLP-1 total volume exceeds 5000 in any given month
                  </div>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 flex items-center justify-between text-xs text-[#9cd3e0] bg-[#183d46]">
                  <div>Showing 1-1 of 2</div>
                  <div className="flex items-center space-x-3">
                    <button className="text-gray-500 cursor-not-allowed"><ChevronLeft size={14} /></button>
                    <span>1 of 2</span>
                    <button className="hover:text-white"><ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - LIGHT CARDS */}
            <div className="col-span-12 lg:col-span-6 space-y-6 flex flex-col">
              
              {/* Product Trend Line Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex-1 min-h-[320px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-800 font-bold">Product Trend</h3>
                  <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={20} /></button>
                </div>
                
                <div className="text-xs text-gray-500 mb-2">Listing count</div>
                
                <div className="h-[250px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={true} 
                        tickLine={false} 
                        tick={<CustomXAxisTick />} 
                        interval={0}
                        stroke="#9ca3af"
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12 }} 
                        domain={[0, 400]}
                        ticks={[0, 100, 200, 300, 400]}
                      />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      
                      {/* Custom lines with specific colors to match the screenshot */}
                      <Line type="monotone" dataKey="cns" name="CNS Med" stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: "#a855f7" }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="cancer" name="Cancer Med" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="pain" name="Pain Med" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: "#f59e0b" }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="glp1" name="GLP-1" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  
                  {/* Floating Labels to match the screenshot roughly */}
                  <div className="absolute right-[40px] top-[15px] text-xs font-bold text-[#a855f7]">CNS Med</div>
                  <div className="absolute right-[110px] top-[60px] text-xs font-bold text-[#10b981]">Cancer Med</div>
                  <div className="absolute right-[30px] top-[95px] text-xs font-bold text-[#f59e0b]">Pain Med</div>
                  <div className="absolute right-[15px] bottom-[50px] text-xs font-bold text-[#3b82f6]">GLP-1</div>
                </div>
              </div>

              {/* Product Wheel (Sunburst Approximation) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex-1 min-h-[350px] relative">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-800 font-bold">Product Wheel</h3>
                  <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal size={20} /></button>
                </div>
                
                {/* Menu icon right side */}
                <div className="absolute right-5 top-12 text-gray-400">
                   <LayoutList size={20} />
                </div>

                <div className="h-[300px] w-full flex items-center justify-center relative">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* Inner Ring (Main Categories) */}
                      <Pie
                        data={innerPieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {innerPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>

                      {/* Outer Ring (Sub Categories) */}
                      <Pie
                        data={outerPieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={92}
                        outerRadius={130}
                        stroke="#fff"
                        strokeWidth={2}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, index }) => {
                          const RADIAN = Math.PI / 180;
                          // Calculate position for text
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="white" 
                              textAnchor="middle" 
                              dominantBaseline="central"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              {outerPieData[index].name}
                            </text>
                          );
                        }}
                        labelLine={false}
                      >
                        {outerPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Custom 'All' Text in Center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-bold text-gray-800 text-sm">All</span>
                  </div>
                  
                  {/* Floating Labels for Inner Ring */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="absolute top-[28%] left-[30%] text-white text-[10px] font-bold -rotate-[45deg]">Cancer Med</span>
                     <span className="absolute top-[28%] right-[32%] text-white text-[10px] font-bold rotate-[45deg]">GLP-1</span>
                     <span className="absolute bottom-[28%] right-[30%] text-white text-[10px] font-bold -rotate-[45deg]">Pain Med</span>
                     <span className="absolute bottom-[28%] left-[32%] text-white text-[10px] font-bold rotate-[45deg]">CNS Med</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}