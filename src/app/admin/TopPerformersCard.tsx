'use client';

import { Search } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { LeaderboardItem } from '@/lib/adminTypes';
import styles from './page.module.css';

function formatPeso(amount: number, fractionDigits = 2) {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}


export default function TopPerformersCard({ leaderboard: allLeaderboardItems }: { leaderboard: LeaderboardItem[] }) {
  const topPerformers = allLeaderboardItems.slice(0, 4);
  const cooperatives = allLeaderboardItems;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'rank' | 'profit' | 'margin'>('rank');

  const maxMargin = Math.max(0.01, ...topPerformers.map((p) => p.netMargin));

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredItems = allLeaderboardItems
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = selectedLevel === 'All' || item.level === selectedLevel;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => {
      if (sortBy === 'profit') return b.monthlyProfit - a.monthlyProfit;
      if (sortBy === 'margin') return b.netMargin - a.netMargin;
      return a.rank - b.rank;
    });

  return (
    <>
      <section className={styles.performersCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Top Performers</h2>
          <span className={styles.cardMeta}>By Net Margin</span>
        </div>

        <ol className={styles.performerList}>
          {topPerformers.map((performer) => {
            const trend =
              performer.change > 0 ? styles.up : performer.change < 0 ? styles.down : styles.flat;

            // Find matching coop id if available
            const matchedCoop = cooperatives.find(
              (c) => c.name.toLowerCase() === performer.name.toLowerCase()
            );

            return (
              <li key={performer.rank} className={styles.performer}>
                <span className={styles.rank}>{performer.rank}</span>

                <div className={styles.performerBody}>
                  <div className={styles.performerTop}>
                    {matchedCoop ? (
                      <Link href={`/admin/cooperative/${matchedCoop.id}`} className={styles.performerLink}>
                        {performer.name}
                      </Link>
                    ) : (
                      <span className={styles.performerName}>{performer.name}</span>
                    )}
                    <span className={styles.performerValue}>
                      {formatPeso(performer.netMargin)}
                    </span>
                  </div>

                  <div className={styles.performerBottom}>
                    <div className={styles.meter}>
                      <div
                        className={styles.meterFill}
                        style={{ width: `${(performer.netMargin / maxMargin) * 100}%` }}
                      />
                    </div>
                    <span className={`${styles.performerChange} ${trend}`}>
                      {performer.change > 0 ? '+' : ''}
                      {performer.change.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className={styles.viewAll}
          onClick={() => setIsModalOpen(true)}
        >
          View All ({cooperatives.length} Cooperatives)
        </button>
      </section>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-modal-title"
        >
          <div className={styles.modalContent}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalBadge}>BEAM Analytics</div>
                <h2 id="leaderboard-modal-title" className={styles.modalTitle}>
                  Top Performing Cooperatives Leaderboard
                </h2>
                <p className={styles.modalSubtitle}>
                  Comprehensive ranking of school cooperatives based on net margin, monthly profit, and stock health.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className={styles.modalControls}>
              <div className={styles.searchBox}>
                <Search size={15} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search cooperative by name or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.clearSearch}
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={styles.filterGroup}>
                <div className={styles.levelTabs}>
                  {['All', 'Elementary', 'High School', 'College'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`${styles.tabBtn} ${selectedLevel === level ? styles.activeTab : ''}`}
                      onClick={() => setSelectedLevel(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <div className={styles.sortSelectWrap}>
                  <span className={styles.sortLabel}>Sort:</span>
                  <select
                    className={styles.sortSelect}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'rank' | 'profit' | 'margin')}
                  >
                    <option value="rank">By Rank</option>
                    <option value="margin">By Net Margin</option>
                    <option value="profit">By Monthly Profit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table / List */}
            <div className={styles.modalBody}>
              {filteredItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <Search size={40} strokeWidth={1.5} aria-hidden="true" />
                  <p>No cooperatives match your search &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                <table className={styles.leaderboardTable}>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Cooperative / School</th>
                      <th scope="col">Level</th>
                      <th scope="col" className={styles.alignRight}>Net Margin</th>
                      <th scope="col" className={styles.alignRight}>Monthly Profit</th>
                      <th scope="col">Stock Status</th>
                      <th scope="col" className={styles.alignCenter}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isTop3 = item.rank <= 3;
                      const badgeClass =
                        item.rank === 1
                          ? styles.rankGold
                          : item.rank === 2
                          ? styles.rankSilver
                          : item.rank === 3
                          ? styles.rankBronze
                          : styles.rankStandard;

                      return (
                        <tr key={item.id} className={isTop3 ? styles.highlightRow : ''}>
                          <td>
                            <span className={`${styles.modalRankBadge} ${badgeClass}`}>
                              #{item.rank}
                            </span>
                          </td>
                          <td>
                            <div className={styles.coopNameCell}>
                              <span className={styles.coopNameText}>{item.name}</span>
                              <span className={styles.coopAddressText}>{item.address}</span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.levelTag}>{item.level}</span>
                          </td>
                          <td className={`${styles.alignRight} ${styles.marginValue}`}>
                            ₱{item.netMargin.toFixed(2)}
                            <span className={styles.marginSub}>/ unit</span>
                          </td>
                          <td className={`${styles.alignRight} ${styles.profitValue}`}>
                            {formatPeso(item.monthlyProfit)}
                          </td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                item.stockStatus === 'In Stock'
                                  ? styles.statusInStock
                                  : item.stockStatus === 'Low Stock'
                                  ? styles.statusLowStock
                                  : styles.statusOut
                              }`}
                            >
                              {item.stockStatus}
                            </span>
                          </td>
                          <td className={styles.alignCenter}>
                            <Link
                              href={`/admin/cooperative/${item.id}`}
                              className={styles.viewDetailBtn}
                              onClick={() => setIsModalOpen(false)}
                            >
                              View Detail →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <span className={styles.footerSummary}>
                Showing <strong>{filteredItems.length}</strong> of <strong>{cooperatives.length}</strong> cooperatives
              </span>
              <div className={styles.footerActions}>
                <Link
                  href="/admin/cooperative"
                  className={styles.directoryLink}
                  onClick={() => setIsModalOpen(false)}
                >
                  Go to Full Directory →
                </Link>
                <button
                  type="button"
                  className={styles.closeFooterBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
