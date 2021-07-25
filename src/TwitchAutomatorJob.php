<?php

declare(strict_types=1);

namespace App;

use DateTime;
use GuzzleHttp\Client;
use Symfony\Component\Process\Process;

class TwitchAutomatorJob
{

	const NO_FILE = 1;
	const NO_DATA = 2;

	public string $name;
	public $pid;
	public string $pidfile;
	public string $pidfile_simple;
	public array $metadata = [];
	public $status;
	public int $error;
	public Process $process;
	public ?\DateTime $dt_started_at;
	// private $tried_loading;

	private function realpath($str){
		return realpath($str) ?: $str;
	}

	/*
	function __construct(string $name)
	{
		$this->name = $name;
		$this->pidfile = $this->realpath(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".json");
		$this->pidfile_simple = $this->realpath(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".pid");
		$this->dt_started_at = new DateTime();
		return $this;
	}
	*/

	public static function load(string $name)
	{

		$job = new self();
		$job->name = $name;
		$job->pidfile = $job->realpath(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".json");
		$job->pidfile_simple = $job->realpath(TwitchHelper::$pids_folder . DIRECTORY_SEPARATOR . $name . ".pid");
		$job->dt_started_at = new DateTime();

		// if no pid file
		if (!file_exists($job->pidfile)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$job->name} failed, no json file", $job->metadata);
			// return $job->loadSimple();
			$job->error = self::NO_FILE;
			return false;
		}

		// read pid file
		$raw = file_get_contents($job->pidfile);
		if (!$raw) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$job->name} failed, no data in json file", $job->metadata);
			$job->error = self::NO_DATA;
			return false;
		}

		$data = json_decode($raw);

		$job->pid = $data->pid;

		$job->dt_started_at = isset($data->dt_started_at) ? new DateTime($data->dt_started_at->date) : null;

		// TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Job {$this->name} loaded, proceed to get status.", $this->metadata);

		// $this->getStatus();
		return $job;
		
	}

	/*
	/**
	 * Load data from disk
	 *
	 * @return bool successful
	 *
	function load()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$this->name} failed, no json file", $this->metadata);
			// return $this->loadSimple();
			$this->error = TwitchAutomatorJob::NO_FILE;
			return false;
		}
		$raw = file_get_contents($this->pidfile);
		if (!$raw) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_ERROR, "job", "Loading job {$this->name} failed, no data in json file", $this->metadata);
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$data = json_decode($raw);
		$this->pid = $data->pid;
		$this->dt_started_at = isset($data->dt_started_at) ? new DateTime($data->dt_started_at->date) : null;

		// TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Job {$this->name} loaded, proceed to get status.", $this->metadata);

		// $this->getStatus();
		return true;
	}
	*/

	/*
	function loadSimple()
	{
		$tried_loading = true;
		if (!file_exists($this->pidfile_simple)) {
            TwitchHelper::log(TwitchHelper::LOG_DEBUG, "Loading job {$this->name} failed, no pid file", $this->metadata);
			$this->error = TwitchAutomatorJob::NO_FILE;
			return false;
		}
		$raw = file_get_contents($this->pidfile_simple);
		if (!$raw) {
			$this->error = TwitchAutomatorJob::NO_DATA;
			return false;
		}
		$this->pid = $raw;
		$this->getStatus();
    }
    */

	/**
	 * Save to disk, like when the process starts
	 *
	 * @return bool
	 */
	function save()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "job", "Save job {$this->name} with PID {$this->pid}", $this->metadata);

		TwitchHelper::webhook([
			'action' => 'job_save',
			'job_name' => $this->name,
			'job' => $this
		]);

		return file_put_contents($this->pidfile, json_encode($this)) != false;
	}

	/**
	 * Remove from disk, like when the process quits
	 *
	 * @return bool success
	 */
	function clear()
	{
		if (isset($this->process)) {
			$this->process = null;
		}

		if (file_exists($this->pidfile)) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_INFO, "job", "Clear job {$this->name} with PID {$this->pid}", $this->metadata);
			
			TwitchHelper::webhook([
				'action' => 'job_clear',
				'job_name' => $this->name,
				'job' => $this
			]);

			return unlink($this->pidfile);
		}
		return false;
	}

	/**
	 * Set process PID
	 *
	 * @param int $pid
	 * @return void
	 */
	function setPid($pid)
	{
		$this->pid = $pid;
	}

	/**
	 * Get process PID
	 *
	 * @return int Process ID
	 */
	function getPid()
	{
		// if (!$this->pid) {
		// 	$this->load();
		// }
		return $this->pid;
	}

	/**
	 * Attach process
	 *
	 * @param Process $process
	 * @return void
	 */
	function setProcess(Process $process)
	{
		// $this->process = $process;
	}

	/**
	 * Attach metadata
	 *
	 * @param array $metadata
	 * @return void
	 */
	function setMetadata(array $metadata)
	{
		$this->metadata = $metadata;
	}

	/**
	 * Get running status of job, PID if running.
	 *
	 * @return int|false
	 */
	function getStatus()
	{
		TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "Check status for job {$this->name}", $this->metadata);

		if(!$this->pid){
			throw new \Exception("No pid set on job");
		}
		/*
		$pid = $this->getPid();

		if (!$pid) {
			return false;
		}
		*/

		$output = TwitchHelper::exec(["ps", "-p", $this->pid]);

		//if (!$this->pid && !$this->tried_loading) {
		//	$this->load();
		//}
		//
		//if (!$this->pid) {
		//	return false;
		//}

		if (mb_strpos($output, (string)$this->pid) !== false) {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "PID file check for '{$this->name}', process is running");
			$this->status = $this->pid;
			return $this->pid;
		} else {
			TwitchHelper::logAdvanced(TwitchHelper::LOG_DEBUG, "job", "PID file check for '{$this->name}', process does not exist");
			$this->status = false;
			return false;
		}
	}

	/**
	 * Quit the process via PID
	 *
	 * @return string kill output
	 */
	function kill()
	{
		if (isset($this->process)) {
			return $this->process->stop();
		}
		$exec = TwitchHelper::exec(["kill", $this->getPid()]);
		$this->clear();
		return $exec;
	}
}
